using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Godot;

namespace Chronopolis;

public enum Detail { Near, Far }

public sealed class WorldQuality
{
    public int NearRadius;
    public int FarRadius;
}

/// <summary>
/// World streaming. The city is divided into 80 m chunks generated on worker threads around the
/// player and freed when far away. Near chunks get full detail (windows, props, trees), far chunks
/// get buildings only, and fog hides everything beyond. Each chunk is one merged mesh (one draw call)
/// plus a terrain mesh.
/// </summary>
public partial class World : Node3D
{
    // ---------------- reserved points ----------------
    sealed record Reserved(double X, double Z, double R);
    static List<Reserved> _reserved;
    static List<Reserved> ReservedPoints
    {
        get
        {
            if (_reserved != null) return _reserved;
            var r = new List<Reserved>();
            foreach (var e in GameData.ChronoportEras) r.Add(new Reserved(e.Chronoport.X, e.Chronoport.Z, 9));
            foreach (var q in GameData.Campaign)
                foreach (var st in q.Steps)
                    if (st.Kind == "talk" || st.Kind == "read" || st.Kind == "goto") r.Add(new Reserved(st.X, st.Z, 6));
            _reserved = r;
            return r;
        }
    }

    /// <summary>Points that must never be built over: chronoports and quest locations.</summary>
    public static bool IsReserved(double x, double z, double pad)
    {
        foreach (var p in ReservedPoints) if (M.Hypot(p.X - x, p.Z - z) < p.R + pad) return true;
        return false;
    }

    /// <summary>Decides whether a lot gets a building. Shared with the map so the map matches the world.</summary>
    public static double LotBuildChance(Era era, Lot lot)
    {
        double u = Chronopolis.Pattern.Urbanity(era, lot.X, lot.Z);
        double p = era.Layout.Density * lot.Weight * u;
        if (u < 0.12 && era.Layout.Fields) p = 0.025 * lot.Weight; // farmsteads
        return p;
    }

    static readonly (double, double)[] ClearSamples = { (0, 0), (-1, -1), (1, -1), (1, 1), (-1, 1), (0, -1), (0, 1), (-1, 0), (1, 0) };

    public static bool LotIsClear(Lot lot, double hw, double hd, ICityPattern pattern)
    {
        if (Macro.SiteClearance(lot.X, lot.Z) != null) return false;
        double margin = Math.Max(hw, hd);
        if (IsReserved(lot.X, lot.Z, margin)) return false;
        if (Macro.ArterialDistance(lot.X, lot.Z) < margin + Macro.ARTERIAL_WIDTH / 2 + 2.4) return false;
        double cs = Math.Cos(lot.Rot), sn = Math.Sin(lot.Rot);
        // the body is set back from the lot line, so test points a little inside the lot
        double ix = Math.Max(0.5, hw - 0.6), iz = Math.Max(0.5, hd - 0.6);
        foreach (var (sx, sz) in ClearSamples)
        {
            double lx = sx * ix, lz = sz * iz;
            double x = lot.X + lx * cs - lz * sn;
            double z = lot.Z + lx * sn + lz * cs;
            if (Macro.WaterDepth(x, z) > -6) return false;
            if (pattern.IsStreet(x, z)) return false;
            if (Math.Abs(x) > Macro.WORLD_HALF - 10 || Math.Abs(z) > Macro.WORLD_HALF - 10) return false;
        }
        return true;
    }

    // ---------------- chunks ----------------
    sealed class ChunkData
    {
        public int Cx, Cz, Gen;
        public Detail Detail;
        public MeshBuilder Mb, Terrain;
        public List<Collider> Colliders;
        public List<BuiltBuilding> Buildings;
    }

    sealed class Chunk
    {
        public int Cx, Cz;
        public Detail Detail;
        public MeshInstance3D Mesh, Terrain;
        public List<Collider> Colliders;
        public List<Collider> Platforms;
        public List<BuiltBuilding> Buildings;
    }

    public Era Era { get; private set; }
    public ICityPattern Pattern { get; private set; }
    public Surfaces Surf { get; private set; }
    public WorldQuality Quality;
    public List<Collider> LandmarkColliders = new();
    List<Collider> _landmarkPlatforms = new();

    readonly Dictionary<(int, int), Chunk> _chunks = new();
    readonly HashSet<(int, int)> _inFlight = new();
    readonly Dictionary<(int, int), Detail> _wanted = new();
    readonly ConcurrentQueue<ChunkData> _ready = new();
    int _gen;
    int _running;
    readonly int _maxWorkers = Math.Max(1, System.Environment.ProcessorCount - 2);

    ShaderMaterial _material;
    ShaderMaterial _terrainMaterial;
    Node3D _static;
    MeshInstance3D _water;
    ShaderMaterial _waterMaterial;

    public int LoadedChunkCount => _chunks.Count;
    public int PendingCount => _wanted.Count + _inFlight.Count;
    public int Triangles { get; private set; }

    public void Init(Era era, WorldQuality quality)
    {
        Quality = quality;
        var shader = GD.Load<Shader>("res://shaders/city.gdshader");
        var atlas = GD.Load<Texture2D>("res://textures/atlas.png");
        var normal = GD.Load<Texture2D>("res://textures/atlas_normal.png");
        _material = new ShaderMaterial { Shader = shader };
        _material.SetShaderParameter("atlas", atlas);
        _material.SetShaderParameter("atlas_normal", normal);
        _material.SetShaderParameter("relief", 1.0);
        _terrainMaterial = (ShaderMaterial)_material.Duplicate();
        _terrainMaterial.SetShaderParameter("depth_bias", 1.0);
        _terrainMaterial.SetShaderParameter("relief", 0.7);
        _static = new Node3D { Name = "Static" };
        AddChild(_static);
        _waterMaterial = new ShaderMaterial { Shader = GD.Load<Shader>("res://shaders/water.gdshader") };
        _water = new MeshInstance3D
        {
            Name = "Water",
            Mesh = new PlaneMesh { Size = new Vector2((float)Macro.WORLD_HALF * 4, (float)Macro.WORLD_HALF * 4), SubdivideWidth = 0, SubdivideDepth = 0 },
            MaterialOverride = _waterMaterial,
            Position = new Vector3(0, (float)Macro.WATER_LEVEL, 0),
            CastShadow = GeometryInstance3D.ShadowCastingSetting.Off,
        };
        AddChild(_water);
        SetEra(era);
    }

    public void SetEra(Era era)
    {
        Era = era;
        Surf = GameData.Surfaces[era.Id];
        Pattern = Chronopolis.Pattern.MakePattern(era, Surf.ParkChance);
        _gen++;
        foreach (var k in _chunks.Keys.ToList()) Unload(k);
        _wanted.Clear();
        _inFlight.Clear();
        while (_ready.TryDequeue(out _)) { }
        _waterMaterial.SetShaderParameter("water_color", M.Col(era.Water));
        _waterMaterial.SetShaderParameter("deep_color", M.Col(M.Shade(era.Water, 0.55)));
        foreach (var c in _static.GetChildren()) c.QueueFree();
        LandmarkColliders = new List<Collider>();
        var art = new MeshBuilder();
        BuildArterials(art);
        AddStatic(art, "Arterials");
        var lm = new MeshBuilder();
        BuildEraSpecials(lm);
        BuildLandmarks(lm);
        AddStatic(lm, "Landmarks");
        _landmarkPlatforms = LandmarkColliders.Where(c => c.Top != null).ToList();
    }

    void AddStatic(MeshBuilder mb, string name)
    {
        if (mb.IsEmpty) return;
        var mi = new MeshInstance3D { Name = name, Mesh = mb.ToMesh(_material), CastShadow = GeometryInstance3D.ShadowCastingSetting.On };
        mi.ExtraCullMargin = 50;
        _static.AddChild(mi);
    }

    // ---------------- streaming ----------------

    /// <summary>Called every frame with the player position: queues and finishes chunks.</summary>
    public void UpdateStreaming(double px, double pz, int maxFinalize = 2)
    {
        int ccx = (int)Math.Floor(px / Macro.CHUNK_SIZE);
        int ccz = (int)Math.Floor(pz / Macro.CHUNK_SIZE);
        int near = Quality.NearRadius, far = Quality.FarRadius;
        foreach (var (k, ch) in _chunks.ToList())
        {
            int d = Math.Max(Math.Abs(ch.Cx - ccx), Math.Abs(ch.Cz - ccz));
            if (d > far + 1) Unload(k);
            else if (ch.Detail == Detail.Far && d <= near) Want(ch.Cx, ch.Cz, Detail.Near);
            else if (ch.Detail == Detail.Near && d > near + 1) Want(ch.Cx, ch.Cz, Detail.Far);
        }
        for (int r = 0; r <= far; r++)
            for (int dx = -r; dx <= r; dx++)
                for (int dz = -r; dz <= r; dz++)
                {
                    if (Math.Max(Math.Abs(dx), Math.Abs(dz)) != r) continue;
                    int cx = ccx + dx, cz = ccz + dz;
                    if (Math.Abs(cx * Macro.CHUNK_SIZE) > Macro.WORLD_HALF + Macro.CHUNK_SIZE || Math.Abs(cz * Macro.CHUNK_SIZE) > Macro.WORLD_HALF + Macro.CHUNK_SIZE) continue;
                    if (!_chunks.ContainsKey((cx, cz))) Want(cx, cz, r <= near ? Detail.Near : Detail.Far);
                }
        // forget wants that are now out of range
        foreach (var k in _wanted.Keys.ToList())
        {
            int d = Math.Max(Math.Abs(k.Item1 - ccx), Math.Abs(k.Item2 - ccz));
            if (d > far + 1) _wanted.Remove(k);
        }
        // start workers, nearest first
        while (_running < _maxWorkers && _wanted.Count > 0)
        {
            var best = _wanted.Keys.OrderBy(k => Math.Max(Math.Abs(k.Item1 - ccx), Math.Abs(k.Item2 - ccz))).First();
            int d = Math.Max(Math.Abs(best.Item1 - ccx), Math.Abs(best.Item2 - ccz));
            var detail = d <= near ? Detail.Near : Detail.Far;
            _wanted.Remove(best);
            Start(best.Item1, best.Item2, detail);
        }
        // finish a few per frame on the main thread
        int n = 0;
        while (n < maxFinalize && _ready.TryDequeue(out var data))
        {
            if (data.Gen != _gen) continue;
            _inFlight.Remove((data.Cx, data.Cz));
            Finalize(data);
            n++;
        }
    }

    void Want(int cx, int cz, Detail d)
    {
        if (_inFlight.Contains((cx, cz))) return;
        if (_chunks.TryGetValue((cx, cz), out var ch) && ch.Detail == d) return;
        _wanted[(cx, cz)] = d;
    }

    void Start(int cx, int cz, Detail detail)
    {
        _inFlight.Add((cx, cz));
        Interlocked.Increment(ref _running);
        int gen = _gen;
        var era = Era;
        var pattern = Pattern;
        var surf = Surf;
        Task.Run(() =>
        {
            try
            {
                var data = BuildChunk(cx, cz, detail, era, pattern, surf);
                data.Gen = gen;
                _ready.Enqueue(data);
            }
            catch (Exception ex)
            {
                GD.PushError($"chunk {cx},{cz}: {ex}");
            }
            finally
            {
                Interlocked.Decrement(ref _running);
            }
        });
    }

    /// <summary>Synchronously build everything around a point (on era entry, behind a loading screen).</summary>
    public void Warmup(double px, double pz)
    {
        int ccx = (int)Math.Floor(px / Macro.CHUNK_SIZE);
        int ccz = (int)Math.Floor(pz / Macro.CHUNK_SIZE);
        var jobs = new List<(int, int, Detail)>();
        int far = Quality.FarRadius, near = Quality.NearRadius;
        for (int dx = -far; dx <= far; dx++)
            for (int dz = -far; dz <= far; dz++)
            {
                int cx = ccx + dx, cz = ccz + dz;
                if (Math.Abs(cx * Macro.CHUNK_SIZE) > Macro.WORLD_HALF + Macro.CHUNK_SIZE || Math.Abs(cz * Macro.CHUNK_SIZE) > Macro.WORLD_HALF + Macro.CHUNK_SIZE) continue;
                if (_chunks.ContainsKey((cx, cz))) continue;
                jobs.Add((cx, cz, Math.Max(Math.Abs(dx), Math.Abs(dz)) <= near ? Detail.Near : Detail.Far));
            }
        var results = new ChunkData[jobs.Count];
        var era = Era;
        var pattern = Pattern;
        var surf = Surf;
        Parallel.For(0, jobs.Count, i => results[i] = BuildChunk(jobs[i].Item1, jobs[i].Item2, jobs[i].Item3, era, pattern, surf));
        foreach (var r in results)
        {
            _wanted.Remove((r.Cx, r.Cz));
            Finalize(r);
        }
    }

    void Finalize(ChunkData d)
    {
        var k = (d.Cx, d.Cz);
        if (_chunks.ContainsKey(k)) Unload(k);
        var ch = new Chunk { Cx = d.Cx, Cz = d.Cz, Detail = d.Detail, Colliders = d.Colliders, Buildings = d.Buildings };
        ch.Platforms = d.Colliders.Where(c => c.Top != null).ToList();
        if (!d.Mb.IsEmpty)
        {
            ch.Mesh = new MeshInstance3D { Mesh = d.Mb.ToMesh(_material), CastShadow = GeometryInstance3D.ShadowCastingSetting.On };
            AddChild(ch.Mesh);
            Triangles += d.Mb.TriangleCount;
        }
        ch.Terrain = new MeshInstance3D { Mesh = d.Terrain.ToMesh(_terrainMaterial), CastShadow = GeometryInstance3D.ShadowCastingSetting.On };
        AddChild(ch.Terrain);
        Triangles += d.Terrain.TriangleCount;
        _chunks[k] = ch;
    }

    void Unload((int, int) k)
    {
        if (!_chunks.TryGetValue(k, out var ch)) return;
        if (ch.Mesh != null)
        {
            Triangles -= ch.Mesh.Mesh.GetFaces().Length / 3;
            ch.Mesh.QueueFree();
        }
        if (ch.Terrain != null)
        {
            Triangles -= ch.Terrain.Mesh.GetFaces().Length / 3;
            ch.Terrain.QueueFree();
        }
        _chunks.Remove(k);
    }

    // ---------------- static geometry: arterials, bridges, walls ----------------

    void BuildArterials(MeshBuilder mb)
    {
        var e = Era;
        foreach (var line in Macro.ARTERIALS) BuildArterialLine(mb, line);
        // city wall along the ring road for walled eras
        if (!e.Layout.Walls) return;
        double r = Macro.RING_ROAD + 12;
        int wallColor = M.Shade(e.Buildings[0].WallColors[0], 0.8);
        var sides = new (double, double, double, double)[] { (-r, -r, r, -r), (r, -r, r, r), (r, r, -r, r), (-r, r, -r, -r) };
        foreach (var (ax, az, bx, bz) in sides)
        {
            double len = M.Hypot(bx - ax, bz - az);
            int n = (int)Math.Ceiling(len / 20);
            mb.Material(e.Layout.Pattern == "spread" ? Tile.WOOD : Tile.STONE, 0.35);
            for (int i = 0; i < n; i++)
            {
                double t = (i + 0.5) / n;
                double x = ax + (bx - ax) * t, z = az + (bz - az) * t;
                if (Macro.IsWater(x, z)) continue;
                if (Macro.IsArterial(x, z, Macro.ARTERIAL_WIDTH + 8)) continue; // gates
                double y = Macro.TerrainHeight(x, z);
                double rot = Math.Atan2(bz - az, bx - ax);
                mb.Box(x, y - 1, z, 20.4, 7, 2.5, wallColor, rot, 0.75);
                for (int k = -4; k <= 4; k++) mb.Box(x + Math.Cos(rot) * k * 2.4, y + 6, z + Math.Sin(rot) * k * 2.4, 1.1, 1.0, 2.7, M.Shade(wallColor, 0.95), rot);
                if (i % 4 == 0) mb.Box(x, y - 1, z, 5, 10, 5, M.Shade(wallColor, 0.95), rot, 0.75);
                LandmarkColliders.Add(new Collider(x, z, 10.2, 1.3, rot, 7, "wall"));
            }
        }
    }

    sealed class Bridge
    {
        public double A, B, Ha, Hb;
    }

    sealed record Corner(double S, double Turn, double Ext);

    /// <summary>
    /// One arterial: road pieces on land, bridges wherever the road dips near or under the water.
    /// A bridge starts and ends on dry ground, its deck is a walkable ramp collider with railed sides.
    /// </summary>
    void BuildArterialLine(MeshBuilder mb, P2[] line)
    {
        var e = Era;
        var surf = Surf;
        double w = Macro.ARTERIAL_WIDTH, hw = w / 2;
        var cum = new List<double> { 0 };
        for (int i = 0; i < line.Length - 1; i++) cum.Add(cum[i] + M.Hypot(line[i + 1].X - line[i].X, line[i + 1].Z - line[i].Z));
        double total = cum[^1];
        (double x, double z, double ux, double uz) At(double s)
        {
            int i = 0;
            while (i < line.Length - 2 && cum[i + 1] < s) i++;
            double len = cum[i + 1] - cum[i];
            if (len == 0) len = 1;
            double t = M.Clamp((s - cum[i]) / len, 0, 1);
            var a = line[i];
            var b = line[i + 1];
            return (a.X + (b.X - a.X) * t, a.Z + (b.Z - a.Z) * t, (b.X - a.X) / len, (b.Z - a.Z) / len);
        }
        double LOW = Macro.WATER_LEVEL + 0.6;
        const double ds = 2;
        int ns = (int)Math.Ceiling(total / ds);
        var low = new bool[ns + 1];
        for (int k = 0; k <= ns; k++)
        {
            var p = At(Math.Min(total, k * ds));
            low[k] = Macro.IsWater(p.x, p.z) || Macro.MeshHeight(p.x, p.z) < LOW;
        }
        var bridges = new List<Bridge>();
        var dead = new List<(double, double)>();
        for (int k = 0; k <= ns; k++)
        {
            if (!low[k]) continue;
            int j = k;
            while (j < ns && low[j + 1]) j++;
            if (k == 0 || j == ns)
            {
                dead.Add(k == 0 ? (-1, j * ds) : (k * ds, total + 1));
                k = j;
                continue;
            }
            double a = Math.Max(0, (k - 1) * ds - 2);
            double b = Math.Min(total, (j + 1) * ds + 2);
            var prev = bridges.Count > 0 ? bridges[^1] : null;
            if (prev != null && a - prev.B < 8) prev.B = b;
            else bridges.Add(new Bridge { A = a, B = b });
            k = j;
        }
        double RoadY(double s)
        {
            var p = At(s);
            return Macro.MeshHeight(p.x, p.z) + 0.07;
        }
        foreach (var br in bridges)
        {
            br.Ha = RoadY(br.A);
            br.Hb = RoadY(br.B);
        }
        double DeckAt(Bridge br, double s)
        {
            double t = M.Clamp((s - br.A) / (br.B - br.A), 0, 1);
            double bs = br.Ha + (br.Hb - br.Ha) * t;
            double crest = Math.Max(Math.Max(br.Ha, br.Hb), Macro.WATER_LEVEL + 2.6);
            double ramp = Math.Min(Math.Min(1, Math.Min(s - br.A, br.B - s) / 25), 2.4 * Math.Sin(Math.PI * t));
            var p = At(s);
            double g = Math.Max(Macro.MeshHeight(p.x, p.z), Math.Max(Macro.MeshHeight(p.x - p.uz * hw, p.z + p.ux * hw), Macro.MeshHeight(p.x + p.uz * hw, p.z - p.ux * hw))) + 0.07;
            return Math.Max(g, bs + (crest - bs) * ramp);
        }
        var marks = new HashSet<double>(cum);
        foreach (var br in bridges)
        {
            marks.Add(br.A);
            marks.Add(br.B);
        }
        var sorted = marks.OrderBy(v => v).ToList();
        var cuts = new List<double>();
        for (int i = 0; i < sorted.Count - 1; i++)
        {
            int n = Math.Max(1, (int)Math.Ceiling((sorted[i + 1] - sorted[i]) / 8));
            for (int k = 0; k < n; k++) cuts.Add(sorted[i] + (sorted[i + 1] - sorted[i]) * k / n);
        }
        cuts.Add(total);
        Func<double, double, double> heightAt = Macro.MeshHeight;
        int stone = M.Shade(e.Road, 0.75);
        var corners = new List<Corner>();
        for (int i = 1; i < line.Length - 1; i++)
        {
            var pa = At(cum[i] - 0.5);
            var pb = At(cum[i] + 0.5);
            double cross = pa.ux * pb.uz - pa.uz * pb.ux;
            double ang = Math.Acos(M.Clamp(pa.ux * pb.ux + pa.uz * pb.uz, -1, 1));
            if (ang < 0.05) continue;
            corners.Add(new Corner(cum[i], Math.Sign(cross), (hw - 0.25) * Math.Tan(ang / 2)));
        }
        for (int i = 0; i < cuts.Count - 1; i++)
        {
            double s0 = cuts[i], s1 = cuts[i + 1];
            if (s1 - s0 < 0.05) continue;
            double mid = (s0 + s1) / 2;
            var (x0, z0, ux, uz) = At(s0 + 0.01);
            var p1 = At(s1 - 0.0001);
            double x1 = p1.x, z1 = p1.z;
            if (dead.Any(dd => mid > dd.Item1 && mid < dd.Item2)) continue;
            var br = bridges.FirstOrDefault(b => mid > b.A && mid < b.B);
            if (br == null)
            {
                Roads.BuildRoadStrip(mb, new[] { new P2(x0, z0), new P2(x1, z1) }, w, surf, heightAt, new StripOptions { Lanes = true, Minor = false });
                continue;
            }
            double nx = -uz, nz = ux;
            bool first = Math.Abs(s0 - br.A) < 0.01, last = Math.Abs(s1 - br.B) < 0.01;
            double y0 = DeckAt(br, s0), y1 = DeckAt(br, s1);
            double Edge(double x, double z, int side, double y, bool end) => end ? Macro.MeshHeight(x + nx * hw * side, z + nz * hw * side) + 0.07 : y;
            double y0L = Edge(x0, z0, 1, y0, first), y0R = Edge(x0, z0, -1, y0, first);
            double y1L = Edge(x1, z1, 1, y1, last), y1R = Edge(x1, z1, -1, y1, last);
            mb.Material(surf.Road, surf.Road == Tile.COBBLE ? 0.6 : 0.35);
            mb.SetColor(M.Shade(surf.RoadColor, 0.97));
            mb.Quad(x0 + nx * hw, y0L, z0 + nz * hw, x1 + nx * hw, y1L, z1 + nz * hw, x1 - nx * hw, y1R, z1 - nz * hw, x0 - nx * hw, y0R, z0 - nz * hw);
            if (surf.LaneMarks)
            {
                mb.Material(Tile.ASPHALT, 0.3);
                mb.SetColor(surf.LaneColor);
                mb.Quad(x0 + nx * 0.1, y0 + 0.012, z0 + nz * 0.1, x1 + nx * 0.1, y1 + 0.012, z1 + nz * 0.1, x1 - nx * 0.1, y1 + 0.012, z1 - nz * 0.1, x0 - nx * 0.1, y0 + 0.012, z0 - nz * 0.1);
            }
            mb.Material(Tile.STONE, 0.35);
            mb.SetColor(stone);
            Slab(mb, x0, z0, x1, z1, -hw, hw, Math.Min(y0L, y0R) - 1.2, y0, Math.Min(y1L, y1R) - 1.2, y1, false, false);
            int pc = M.Shade(stone, 1.1);
            var cEnd = corners.FirstOrDefault(k => Math.Abs(k.S - s1) < 0.01);
            var cStart = corners.FirstOrDefault(k => Math.Abs(k.S - s0) < 0.01);
            if (cEnd != null)
            {
                mb.Material(surf.Road, surf.Road == Tile.COBBLE ? 0.6 : 0.35);
                mb.SetColor(M.Shade(surf.RoadColor, 0.97));
                double yc = y1 - 0.012;
                mb.Quad(x1 - ux * hw + nx * hw, yc, z1 - uz * hw + nz * hw, x1 + ux * hw + nx * hw, yc, z1 + uz * hw + nz * hw, x1 + ux * hw - nx * hw, yc, z1 + uz * hw - nz * hw, x1 - ux * hw - nx * hw, yc, z1 - uz * hw - nz * hw);
                LandmarkColliders.Add(new Collider(x1, z1, hw, hw, Math.Atan2(uz, ux), 0, "bridge") { Top = y1 });
                mb.Material(Tile.STONE, 0.35);
            }
            mb.SetColor(pc);
            foreach (int side in new[] { -1, 1 })
            {
                double o0 = side > 0 ? hw - 0.5 : -hw, o1 = side > 0 ? hw : -hw + 0.5;
                double pa = side > 0 ? y0L : y0R, pb = side > 0 ? y1L : y1R;
                double len0 = s1 - s0;
                double e0 = cStart != null ? M.Clamp(cStart.Turn == side ? -cStart.Ext : cStart.Ext, -len0 + 0.3, hw) : 0;
                double e1 = cEnd != null ? M.Clamp(cEnd.Turn == side ? -cEnd.Ext : cEnd.Ext, -len0 + 0.3, hw) : 0;
                double qx0 = x0 - ux * e0, qz0 = z0 - uz * e0, qx1 = x1 + ux * e1, qz1 = z1 + uz * e1;
                if (e0 + e1 + len0 < 0.5) continue;
                Slab(mb, qx0, qz0, qx1, qz1, o0, o1, pa - 0.1, pa + 1.05, pb - 0.1, pb + 1.05, true, true);
                double len = e0 + e1 + len0;
                LandmarkColliders.Add(new Collider((qx0 + qx1) / 2 + nx * side * (hw - 0.25), (qz0 + qz1) / 2 + nz * side * (hw - 0.25), len / 2 + 0.1, 0.3, Math.Atan2(uz, ux), 1.1, "parapet"));
                if (first) mb.Box(x0 + nx * side * (hw - 0.25) + ux * 0.4, pa - 0.3, z0 + nz * side * (hw - 0.25) + uz * 0.4, 0.9, 1.75, 0.9, M.Shade(pc, 0.92), Math.Atan2(uz, ux));
                if (last) mb.Box(x1 + nx * side * (hw - 0.25) - ux * 0.4, pb - 0.3, z1 + nz * side * (hw - 0.25) - uz * 0.4, 0.9, 1.75, 0.9, M.Shade(pc, 0.92), Math.Atan2(uz, ux));
            }
            // walkable deck, overlapping the next piece a little so there is never a seam
            var deck = Collision.Ramp(x0, z0, y0, x1, z1, y1, w - 0.6, "bridge");
            deck.Hw += 0.15;
            LandmarkColliders.Add(deck);
            if (first || last)
            {
                double ax = first ? x0 : x1, az = first ? z0 : z1, ay = first ? y0 : y1;
                int back = first ? -1 : 1;
                mb.SetColor(M.Shade(stone, 0.9));
                double bottom = Math.Min(ay, Macro.MeshHeight(ax, az)) - 2.5;
                mb.Box(ax + ux * back * 1.5, bottom, az + uz * back * 1.5, 3, ay - 0.2 - bottom, w + 1.4, M.Shade(stone, 0.9), Math.Atan2(uz, ux));
            }
            var pm = At(mid);
            if (Macro.WaterDepth(pm.x, pm.z) > 2 && Math.Floor(mid / 16) != Math.Floor(s0 / 16))
            {
                double py = DeckAt(br, mid) - 1.15;
                double rot = Math.Atan2(uz, ux);
                mb.Box(pm.x, -5, pm.z, 2.6, py + 5, w * 0.92, stone, rot);
                mb.Box(pm.x, -5, pm.z, 2.4, Macro.WATER_LEVEL + 5.6, 2.4, stone, rot + Math.PI / 4);
            }
            if (Math.Floor(mid / 24) != Math.Floor(s0 / 24) && !first && !last)
            {
                double rot = Math.Atan2(uz, ux);
                double ym = DeckAt(br, mid);
                foreach (int side in new[] { -1, 1 })
                {
                    mb.Material(Tile.CONCRETE, 1);
                    double lx = pm.x + nx * side * (hw - 0.25), lz = pm.z + nz * side * (hw - 0.25);
                    mb.Box(lx, ym + 1.0, lz, 0.3, 2.6, 0.3, 0x3a3a3a, rot);
                    mb.Box(lx, ym + 3.6, lz, 0.6, 0.5, 0.6, 0xffe8a0, rot);
                }
            }
        }
    }

    /// <summary>Era one-offs not tied to a site: the Roman aqueduct across the east bank.</summary>
    void BuildEraSpecials(MeshBuilder mb)
    {
        if (Era.Id != "roman") return;
        int stone = 0xd9cfbc;
        mb.Material(Tile.STONE, 0.35);
        double z = -120 - Macro.ARTERIAL_WIDTH / 2 - 10.5;
        for (double x = 230; x <= 610; x += 8)
        {
            if (Macro.IsWater(x, z)) continue;
            double y = Macro.TerrainHeight(x, z);
            double channelY = Macro.TerrainHeight(610, z) + 12;
            double top = Math.Max(6, channelY - y);
            mb.Box(x, y - 1, z, 2.2, top + 1, 2.6, stone, 0, 0.75);
            LandmarkColliders.Add(new Collider(x, z, 1.1, 1.3, 0, top, "aqueduct"));
            mb.Material(Tile.CONCRETE, 0.3);
            mb.ArchQuad(x + 4, y + 2, z + 1.31, 5.6, top - 3.5, 0, 1, 0x1e2228);
            mb.ArchQuad(x + 4, y + 2, z - 1.31, 5.6, top - 3.5, 0, -1, 0x1e2228);
            mb.Material(Tile.STONE, 0.35);
            mb.Box(x + 4, y + top - 2.6, z, 8.2, 2.6, 2.6, stone);
            mb.Box(x + 4, y + top, z, 8.2, 1.3, 3.2, M.Shade(stone, 0.92));
        }
    }

    void BuildLandmarks(MeshBuilder mb)
    {
        foreach (var id in Macro.SITE_ORDER)
        {
            var site = Macro.SITES[id];
            string k = Landmarks.LandmarkKeyForSite(Era, id);
            if (k == null) continue;
            var rng = new Rng(Hash.Hash2(site.X, site.Z, 77) * 1e9);
            double y = Macro.TerrainHeight(site.X, site.Z);
            LandmarkColliders.AddRange(Landmarks.BuildLandmark(mb, k, site, Era, y, rng));
        }
    }

    // ---------------- chunk generation (worker threads) ----------------

    ChunkData BuildChunk(int cx, int cz, Detail detail, Era e, ICityPattern pattern, Surfaces surf)
    {
        double x0 = cx * Macro.CHUNK_SIZE, z0 = cz * Macro.CHUNK_SIZE;
        double x1 = x0 + Macro.CHUNK_SIZE, z1 = z0 + Macro.CHUNK_SIZE;
        var rng = new Rng(Hash.Hash2(cx, cz, 4242) * 1e9);
        var mb = new MeshBuilder();
        var colliders = new List<Collider>();
        var buildings = new List<BuiltBuilding>();
        var terrain = BuildTerrain(x0, z0, e, surf);

        // minor streets
        Func<double, double, double> heightAt = Macro.MeshHeight;
        double roadEdge = Macro.ARTERIAL_WIDTH / 2 + 0.2;
        foreach (var strip in pattern.StripsInRect(x0, z0, x1, z1))
        {
            bool canal = surf.Canals && Hash.Hash2(M.Round(strip.Points[0].X), M.Round(strip.Points[0].Z), 88) < 0.45;
            for (int i = 0; i < strip.Points.Count - 1; i++)
            {
                double ax = strip.Points[i].X, az = strip.Points[i].Z, bx = strip.Points[i + 1].X, bz = strip.Points[i + 1].Z;
                double mx = (ax + bx) / 2, mz = (az + bz) / 2;
                if (mx < x0 || mx >= x1 || mz < z0 || mz >= z1) continue;
                if (Macro.WaterDepth(mx, mz) > -4) continue;
                var site = Macro.SiteClearance(mx, mz);
                if (site != null && site.Id != "market") continue;
                double u = Chronopolis.Pattern.Urbanity(e, mx, mz);
                if (u < (e.Layout.Pattern == "spread" ? 0.02 : 0.15)) continue;
                double da = Macro.ArterialDistance(ax, az), db = Macro.ArterialDistance(bx, bz);
                if (da < roadEdge && db < roadEdge) continue;
                if (da < roadEdge || db < roadEdge)
                {
                    double lo = 0, hi = 1;
                    bool aInside = da < roadEdge;
                    for (int k = 0; k < 8; k++)
                    {
                        double m = (lo + hi) / 2;
                        bool inside = Macro.ArterialDistance(ax + (bx - ax) * m, az + (bz - az) * m) < roadEdge;
                        if (inside == aInside) lo = m;
                        else hi = m;
                    }
                    double t = (lo + hi) / 2;
                    if (aInside)
                    {
                        double nax = ax + (bx - ax) * t, naz = az + (bz - az) * t;
                        ax = nax;
                        az = naz;
                    }
                    else
                    {
                        double nbx = ax + (bx - ax) * t, nbz = az + (bz - az) * t;
                        bx = nbx;
                        bz = nbz;
                    }
                    if (M.Hypot(bx - ax, bz - az) < 0.5) continue;
                }
                Roads.BuildRoadStrip(mb, new[] { new P2(ax, az), new P2(bx, bz) }, strip.Width, surf, heightAt,
                    new StripOptions { Lanes = false, Minor = true, Canal = canal && u > 0.4, Lift = strip.Layer * 0.025 });
            }
        }

        // parks and gardens
        foreach (var park in pattern.ParksInRect(x0, z0, x1, z1)) BuildPark(mb, park, detail, colliders, e, surf);

        // buildings
        foreach (var lot in pattern.LotsInRect(x0, z0, x1, z1))
        {
            double p = LotBuildChance(e, lot);
            if (Hash.Hash2(M.Round(lot.X * 10), M.Round(lot.Z * 10), 9) > p) continue;
            double hw = lot.W * 0.5, hd = lot.D * 0.5;
            if (!LotIsClear(lot, hw, hd, pattern)) continue;
            double y = Macro.MeshHeight(lot.X, lot.Z);
            var lrng = new Rng(lot.Seed);
            double u = Chronopolis.Pattern.Urbanity(e, lot.X, lot.Z);
            BuildingTemplate tmpl = null;
            if (u < 0.12) tmpl = e.Buildings[Math.Min(1, e.Buildings.Length - 1)];
            var b = Buildings.BuildBuilding(mb, lot, e, y, lrng, tmpl, detail == Detail.Near, heightAt);
            if (b == null) continue;
            colliders.Add(b);
            colliders.AddRange(b.Extra);
            buildings.Add(b);
        }

        if (detail == Detail.Near)
        {
            // props beside doors
            foreach (var b in buildings)
            {
                if (!rng.Chance(e.PropDensity * 0.35)) continue;
                string kind = rng.Pick(e.Props);
                double dx = b.DoorX - b.X, dz = b.DoorZ - b.Z;
                double len = M.Hypot(dx, dz);
                if (len == 0) len = 1;
                double side = (rng.Chance(0.5) ? 1 : -1) * rng.Range(2.2, 3.4);
                double px = b.DoorX + (dx / len) * 0.6 + (-dz / len) * side;
                double pz = b.DoorZ + (dz / len) * 0.6 + (dx / len) * side;
                if (px < x0 || px >= x1 || pz < z0 || pz >= z1) continue;
                if (Macro.IsArterial(px, pz, Macro.ARTERIAL_WIDTH + 2) || Macro.IsWater(px, pz) || Macro.MeshHeight(px, pz) < Macro.WATER_LEVEL + 0.5 || IsReserved(px, pz, 1)) continue;
                if (colliders.Any(c => Math.Abs(c.X - px) < c.Hw + 1 && Math.Abs(c.Z - pz) < c.Hd + 1 && c != b)) continue;
                double r = Props.BuildProp(mb, px, Macro.MeshHeight(px, pz), pz, kind, rng, rng.Range(0, Math.PI * 2));
                if (r > 0.3) colliders.Add(new Collider(px, pz, r, r, 0, 2, "prop"));
            }
            // street furniture along arterials
            const double step = 18;
            for (double x = x0; x < x1; x += step)
                for (double z = z0; z < z1; z += step)
                {
                    double h = Hash.Hash2(x, z, 55);
                    if (h > 0.6) continue;
                    double d = Macro.ArterialDistance(x, z);
                    if (d < Macro.ARTERIAL_WIDTH / 2 + 1 || d > Macro.ARTERIAL_WIDTH / 2 + 2.5) continue;
                    if (Macro.IsWater(x, z) || Macro.MeshHeight(x, z) < Macro.WATER_LEVEL + 0.5 || Macro.SiteClearance(x, z) != null) continue;
                    if (Chronopolis.Pattern.Urbanity(e, x, z) < 0.2) continue;
                    if (colliders.Any(c => Math.Abs(c.X - x) < c.Hw + 1 && Math.Abs(c.Z - z) < c.Hd + 1)) continue;
                    string kind = e.Props.Contains("lamp") ? "lamp" : e.Props.Contains("gaslamp") ? "gaslamp" : e.Props.Contains("torch") ? "torch" : e.Props.Contains("lantern") ? "lantern" : rng.Pick(e.Props);
                    double r = Props.BuildProp(mb, x, Macro.MeshHeight(x, z), z, kind, rng, 0);
                    if (r > 0.3) colliders.Add(new Collider(x, z, r, r, 0, 2, "prop"));
                }
            // trees
            if (e.Trees != "none")
            {
                const double cell = 9;
                for (double x = x0; x < x1; x += cell)
                    for (double z = z0; z < z1; z += cell)
                    {
                        double h = Hash.Hash2(x, z, 33);
                        double u = Chronopolis.Pattern.Urbanity(e, x, z);
                        double dens = e.TreeDensity * (0.08 + 0.3 * (1 - u));
                        if (h > dens) continue;
                        double px = x + Hash.Hash2(x, z, 34) * cell, pz = z + Hash.Hash2(x, z, 35) * cell;
                        if (Macro.WaterDepth(px, pz) > -3 || Macro.MeshHeight(px, pz) < Macro.WATER_LEVEL + 0.5 || Macro.IsArterial(px, pz, Macro.ARTERIAL_WIDTH + 3) || pattern.IsStreet(px, pz) || IsReserved(px, pz, 1)) continue;
                        if (Macro.SiteClearance(px, pz) != null) continue;
                        if (M.Hypot(px - Macro.HILL.X, pz - Macro.HILL.Z) < Macro.HILL.Plateau + 10 && u < 0.3) continue;
                        if (colliders.Any(c => Math.Abs(c.X - px) < c.Hw + 2 && Math.Abs(c.Z - pz) < c.Hd + 2)) continue;
                        double r = Props.BuildTree(mb, px, Macro.MeshHeight(px, pz), pz, e.Trees, rng);
                        if (r > 0) colliders.Add(new Collider(px, pz, r, r, 0, 5, "tree"));
                    }
            }
        }
        return new ChunkData { Cx = cx, Cz = cz, Detail = detail, Mb = mb, Terrain = terrain, Colliders = colliders, Buildings = buildings };
    }

    void BuildPark(MeshBuilder mb, Park park, Detail detail, List<Collider> colliders, Era e, Surfaces surf)
    {
        if (surf.Park == "none") return;
        double hw = park.W / 2 - 0.5, hd = park.D / 2 - 0.5;
        mb.Material(surf.ParkTile, 0.3);
        mb.SetColor(M.Shade(surf.ParkColor, 0.9 + 0.2 * Hash.Hash2(park.Seed, 1, 3)));
        TerrainPatch(mb, park.X - hw, park.Z - hd, park.X + hw, park.Z + hd, 2.5, 0.03);
        if (surf.Park == "garden")
        {
            mb.Material(Tile.STONE, 0.6);
            int wc = M.Shade(surf.PlazaColor, 0.85);
            WallAlong(mb, park.X - hw, park.Z - hd, park.X + hw, park.Z - hd, 0.4, 0.7, wc);
            WallAlong(mb, park.X - hw, park.Z + hd, park.X + hw, park.Z + hd, 0.4, 0.7, wc);
            WallAlong(mb, park.X - hw, park.Z - hd, park.X - hw, park.Z + hd, 0.4, 0.7, wc);
            WallAlong(mb, park.X + hw, park.Z - hd, park.X + hw, park.Z + hd, 0.4, 0.7, wc);
            colliders.Add(new Collider(park.X, park.Z - hd, hw - 3, 0.2, 0, 0.7));
            colliders.Add(new Collider(park.X, park.Z + hd, hw - 3, 0.2, 0, 0.7));
            colliders.Add(new Collider(park.X - hw, park.Z, 0.2, hd - 3, 0, 0.7));
            colliders.Add(new Collider(park.X + hw, park.Z, 0.2, hd - 3, 0, 0.7));
        }
        // paths: a cross through the middle
        mb.Material(surf.PathTile, 0.4);
        mb.SetColor(surf.PathColor);
        TerrainPatch(mb, park.X - hw, park.Z - 1.4, park.X + hw, park.Z + 1.4, 2.5, 0.05);
        TerrainPatch(mb, park.X - 1.4, park.Z - hd, park.X + 1.4, park.Z + hd, 2.5, 0.05);
        if (detail != Detail.Near) return;
        var prng = new Rng(park.Seed);
        string centre = e.Props.Contains("fountain") ? "fountain" : e.Props.Contains("statue") ? "statue" : e.Props.Contains("well") ? "well" : e.Props.Contains("shrine") ? "shrine" : "altar";
        if (Macro.MeshHeight(park.X, park.Z) > Macro.WATER_LEVEL + 0.5)
        {
            double r = Props.BuildProp(mb, park.X, Macro.MeshHeight(park.X, park.Z), park.Z, centre, prng);
            if (r > 0.3) colliders.Add(new Collider(park.X, park.Z, r, r, 0, 2));
        }
        if (e.Trees != "none")
        {
            int n = surf.Park == "orchard" ? 12 : 8;
            for (int i = 0; i < n; i++)
            {
                double tx, tz;
                if (surf.Park == "orchard")
                {
                    const int cols = 4;
                    tx = park.X - hw + 3 + ((i % cols) + 0.5) * ((park.W - 6) / cols);
                    tz = park.Z - hd + 3 + (Math.Floor((double)i / cols) + 0.5) * ((park.D - 6) / 3);
                }
                else
                {
                    tx = park.X + prng.Range(-hw + 2, hw - 2);
                    tz = park.Z + prng.Range(-hd + 2, hd - 2);
                }
                if (Math.Abs(tx - park.X) < 2.5 || Math.Abs(tz - park.Z) < 2.5) continue;
                if (Macro.MeshHeight(tx, tz) < Macro.WATER_LEVEL + 0.5 || Macro.WaterDepth(tx, tz) > -3) continue;
                double tr = Props.BuildTree(mb, tx, Macro.MeshHeight(tx, tz), tz, e.Trees, prng);
                if (tr > 0) colliders.Add(new Collider(tx, tz, tr, tr, 0, 5, "tree"));
            }
        }
        string sideKind = e.Props.Contains("bench") ? "bench" : e.Props.Contains("lantern") ? "lantern" : e.Props.Contains("torch") ? "torch" : null;
        if (sideKind != null)
        {
            var spots = new (double, double, double)[] { (-hw * 0.5, -2.4, 0), (hw * 0.5, 2.4, Math.PI), (-2.4, hd * 0.5, Math.PI / 2), (2.4, -hd * 0.5, -Math.PI / 2) };
            foreach (var (ox, oz, rot) in spots)
            {
                if (Macro.MeshHeight(park.X + ox, park.Z + oz) < Macro.WATER_LEVEL + 0.5) continue;
                double pr = Props.BuildProp(mb, park.X + ox, Macro.MeshHeight(park.X + ox, park.Z + oz), park.Z + oz, sideKind, prng, rot);
                if (pr > 0.3) colliders.Add(new Collider(park.X + ox, park.Z + oz, pr, pr, 0, 1));
            }
        }
    }

    MeshBuilder BuildTerrain(double x0, double z0, Era e, Surfaces surf)
    {
        const int n = 16;
        double s = Macro.CHUNK_SIZE / n;
        var mb = new MeshBuilder();
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
            {
                double ax = x0 + i * s, az = z0 + j * s, bx = ax + s, bz = az + s;
                double cx = ax + s / 2, cz = az + s / 2;
                var (color, tile) = GroundColor(cx, cz, e, surf);
                mb.Material(tile, 0.25);
                mb.SetColor(color);
                double y00 = Macro.TerrainHeight(ax, az), y10 = Macro.TerrainHeight(bx, az), y11 = Macro.TerrainHeight(bx, bz), y01 = Macro.TerrainHeight(ax, bz);
                mb.Quad(ax, y00, az, ax, y01, bz, bx, y11, bz, bx, y10, az);
                var site = Macro.SiteClearance(cx, cz);
                if (site != null && !Macro.IsWater(cx, cz))
                {
                    mb.Material(surf.Plaza, 0.35);
                    mb.SetColor(surf.PlazaColor);
                    mb.Quad(ax, y00 + 0.03, az, ax, y01 + 0.03, bz, bx, y11 + 0.03, bz, bx, y10 + 0.03, az);
                }
            }
        return mb;
    }

    static (int, int) GroundColor(double x, double z, Era e, Surfaces surf)
    {
        double wd = Macro.WaterDepth(x, z);
        if (wd > -10) return (M.Shade(0xc9b68a, 0.95 + 0.1 * Hash.Hash2(x, z, 1)), Tile.SAND);
        double h = Macro.TerrainHeight(x, z);
        double u = Chronopolis.Pattern.Urbanity(e, x, z);
        int c, tile;
        if (e.Layout.Fields && u < 0.25)
        {
            double fx = Math.Floor(x / 42), fz = Math.Floor(z / 34);
            double hh = Hash.Hash2(fx, fz, 12);
            int[] crops = { M.Shade(surf.OutskirtsColor, 1.1), 0xb8a85a, 0x8fa860, 0xc9b06a, M.Shade(surf.OutskirtsColor, 0.9), 0x7f9a4a };
            c = crops[(int)Math.Floor(hh * crops.Length)];
            c = M.Shade(c, 1 + (Hash.Hash2(x, z, 2) - 0.5) * 0.08);
            tile = hh < 0.5 ? Tile.GRASS : Tile.DIRT;
        }
        else if (u < 0.3)
        {
            c = M.Shade(surf.OutskirtsColor, 1 + (Hash.Hash2(x, z, 3) - 0.5) * 0.08);
            tile = surf.Outskirts;
        }
        else
        {
            double t = M.Smoothstep(0.3, 0.7, u);
            c = M.MixColor(surf.OutskirtsColor, surf.CoreColor, t);
            c = M.Shade(c, 1 + (Hash.Hash2(x, z, 3) - 0.5) * 0.05);
            tile = t > 0.5 ? surf.Core : surf.Outskirts;
        }
        if (h > 6) c = M.Shade(c, 1 - M.Clamp((h - 6) / 40, 0, 0.3));
        return (c, tile);
    }

    // ---------------- queries ----------------

    /// <summary>Colliders near a point (3x3 chunk neighbourhood plus landmarks).</summary>
    public List<Collider> CollidersNear(double px, double pz, double radius, List<Collider> outList)
    {
        outList.Clear();
        int ccx = (int)Math.Floor(px / Macro.CHUNK_SIZE), ccz = (int)Math.Floor(pz / Macro.CHUNK_SIZE);
        for (int dx = -1; dx <= 1; dx++)
            for (int dz = -1; dz <= 1; dz++)
            {
                if (!_chunks.TryGetValue((ccx + dx, ccz + dz), out var ch)) continue;
                foreach (var c in ch.Colliders)
                {
                    double r = Math.Max(c.Hw, c.Hd) + radius;
                    if (Math.Abs(c.X - px) < r && Math.Abs(c.Z - pz) < r) outList.Add(c);
                }
            }
        foreach (var c in LandmarkColliders)
        {
            double r = Math.Max(c.Hw, c.Hd) + radius;
            if (Math.Abs(c.X - px) < r && Math.Abs(c.Z - pz) < r) outList.Add(c);
        }
        return outList;
    }

    public List<BuiltBuilding> BuildingsNear(double px, double pz, double radius)
    {
        var o = new List<BuiltBuilding>();
        foreach (var ch in _chunks.Values)
            foreach (var b in ch.Buildings)
                if (M.Hypot(b.X - px, b.Z - pz) < radius) o.Add(b);
        return o;
    }

    /// <summary>
    /// Walkable ground height: the terrain, or the highest floor, step, terrace or deck within step
    /// reach of fromY (leave it out for the topmost surface).
    /// </summary>
    public double GroundY(double x, double z, double fromY = double.PositiveInfinity)
    {
        double g = Macro.MeshHeight(x, z);
        double lim = fromY + Collision.STEP_UP;
        void Scan(List<Collider> list)
        {
            foreach (var c in list)
            {
                double r = c.Hw + c.Hd;
                if (Math.Abs(c.X - x) > r || Math.Abs(c.Z - z) > r) continue;
                if (!Collision.PointIn(c, x, z)) continue;
                double t = Collision.TopAt(c, x, z);
                if (t > g && t <= lim) g = t;
            }
        }
        int ccx = (int)Math.Floor(x / Macro.CHUNK_SIZE), ccz = (int)Math.Floor(z / Macro.CHUNK_SIZE);
        for (int dx = -1; dx <= 1; dx++)
            for (int dz = -1; dz <= 1; dz++)
                if (_chunks.TryGetValue((ccx + dx, ccz + dz), out var ch) && ch.Platforms.Count > 0) Scan(ch.Platforms);
        Scan(_landmarkPlatforms);
        return g;
    }

    // ---------------- geometry helpers ----------------

    /// <summary>A straight prism between two cross-sections (lateral offsets o0..o1, left of the direction positive).</summary>
    static void Slab(MeshBuilder mb, double ax, double az, double bx, double bz, double o0, double o1, double botA, double topA, double botB, double topB, bool top, bool caps)
    {
        double len = M.Hypot(bx - ax, bz - az);
        if (len == 0) len = 1;
        double ux = (bx - ax) / len, uz = (bz - az) / len;
        double nx = -uz, nz = ux;
        (double, double, double) A(double o, double y) => (ax + nx * o, y, az + nz * o);
        (double, double, double) B(double o, double y) => (bx + nx * o, y, bz + nz * o);
        void Q((double, double, double) a, (double, double, double) b, (double, double, double) c, (double, double, double) d) =>
            mb.Quad(a.Item1, a.Item2, a.Item3, b.Item1, b.Item2, b.Item3, c.Item1, c.Item2, c.Item3, d.Item1, d.Item2, d.Item3);
        if (top) Q(A(o1, topA), B(o1, topB), B(o0, topB), A(o0, topA));
        Q(A(o0, botA), B(o0, botB), B(o1, botB), A(o1, botA));
        Q(B(o1, botB), B(o1, topB), A(o1, topA), A(o1, botA));
        Q(A(o0, botA), A(o0, topA), B(o0, topB), B(o0, botB));
        if (caps)
        {
            Q(A(o0, botA), A(o1, botA), A(o1, topA), A(o0, topA));
            Q(B(o1, botB), B(o0, botB), B(o0, topB), B(o1, topB));
        }
    }

    /// <summary>Ground-following patch: a grid of quads on the terrain mesh plus a lift.</summary>
    static void TerrainPatch(MeshBuilder mb, double x0, double z0, double x1, double z1, double step, double lift)
    {
        int nx = Math.Max(1, (int)Math.Ceiling((x1 - x0) / step));
        int nz = Math.Max(1, (int)Math.Ceiling((z1 - z0) / step));
        for (int i = 0; i < nx; i++)
            for (int j = 0; j < nz; j++)
            {
                double ax = x0 + (x1 - x0) * i / nx, bx = x0 + (x1 - x0) * (i + 1) / nx;
                double az = z0 + (z1 - z0) * j / nz, bz = z0 + (z1 - z0) * (j + 1) / nz;
                mb.Quad(ax, Macro.MeshHeight(ax, az) + lift, az, ax, Macro.MeshHeight(ax, bz) + lift, bz, bx, Macro.MeshHeight(bx, bz) + lift, bz, bx, Macro.MeshHeight(bx, az) + lift, az);
            }
    }

    /// <summary>A low wall in segments that step with the terrain.</summary>
    static void WallAlong(MeshBuilder mb, double ax, double az, double bx, double bz, double thick, double h, int color)
    {
        double len = M.Hypot(bx - ax, bz - az);
        int n = Math.Max(1, (int)Math.Ceiling(len / 6));
        double rot = Math.Atan2(bz - az, bx - ax);
        for (int i = 0; i < n; i++)
        {
            double t0 = (double)i / n, t1 = (double)(i + 1) / n;
            double mx = ax + (bx - ax) * ((t0 + t1) / 2), mz = az + (bz - az) * ((t0 + t1) / 2);
            double ya = Macro.MeshHeight(ax + (bx - ax) * t0, az + (bz - az) * t0), yb = Macro.MeshHeight(ax + (bx - ax) * t1, az + (bz - az) * t1);
            double y = Math.Min(ya, yb), top = Math.Max(ya, yb) + h;
            mb.Box(mx, y - 0.2, mz, len / n + 0.05, top - y + 0.2, thick, color, rot);
        }
    }
}
