using System;
using System.Collections.Generic;
using Godot;

namespace Chronopolis;

// Port of src/npc/npc.ts: ambient townsfolk that wander the street graph, plus quest NPCs and
// inspectable objects placed by the quest system. (QuestNpcSpec lives in Game/Shared.cs.)

public sealed class Npc
{
    public Character Figure;
    public Node3D Group;
    public double X;
    public double Z;
    public double Y = 0;
    public double Yaw = 0;
    public double Speed = 0;
    public string Name;
    public string Role;
    public string[] Lines;
    public string QuestId;
    public bool IsObject;
    public StreetNode Target;
    public StreetNode Current;
    public double Talking = 0;
    public double Idle = 0;
    /// <summary>The floating quest marker (TS: the child named 'marker'), or null.</summary>
    public MeshInstance3D MarkerMesh;

    public Npc(NpcArchetype arch, string name, double x, double z, string questId, bool isObject, string eraId = "industrial", int variant = 0)
    {
        Name = name;
        Role = arch.Role;
        Lines = arch.Lines;
        QuestId = questId;
        IsObject = isObject;
        X = x;
        Z = z;
        if (isObject)
        {
            Figure = null;
            Group = new Node3D { Name = "QuestObject" };
            var m = Octahedron(0.35, 0xffd36a);
            m.Position = new Vector3(0, 1.2f, 0);
            m.Name = "marker";
            Group.AddChild(m);
            MarkerMesh = m;
            var b = Octahedron(0.5, 0x8a7a5a);
            b.Scale = new Vector3(1, 0.4f, 1);
            b.Position = new Vector3(0, 0.2f, 0);
            Group.AddChild(b);
        }
        else
        {
            var all = GameData.Cast;
            var cast = all.TryGetValue(eraId, out var ec) && ec != null ? ec : all["industrial"];
            bool hasOutfit = !string.IsNullOrEmpty(arch.Outfit);
            // story characters from 1938 keep their own clothes wherever they turn up
            Outfit story = hasOutfit && !cast.Roles.ContainsKey(arch.Outfit) && all["industrial"].Roles.TryGetValue(arch.Outfit, out var so) ? so : null;
            string key = hasOutfit && cast.Roles.ContainsKey(arch.Outfit) ? arch.Outfit : Cast.OutfitKeyForRole(eraId, arch.Role);
            if (!cast.Roles.ContainsKey(key)) key = FirstKey(cast.Roles);
            Figure = story != null
                ? new Character(story, $"story:{arch.Outfit}")
                : new Character(Cast.VaryOutfit(cast.Roles[key], variant), $"{eraId}:{key}:{variant}");
            Group = Figure.Root;
            if (questId != null)
            {
                var m = Octahedron(0.22, 0xffd36a);
                m.Position = new Vector3(0, 2.5f, 0);
                m.Name = "marker";
                Group.AddChild(m);
                MarkerMesh = m;
            }
        }
    }

    static string FirstKey(Dictionary<string, Outfit> d)
    {
        foreach (var k in d.Keys) return k; // JSON insertion order, like Object.keys
        return null;
    }

    static readonly Dictionary<int, StandardMaterial3D> Mats = new();

    /// <summary>three's OctahedronGeometry(r) with an unlit MeshBasicMaterial.</summary>
    static MeshInstance3D Octahedron(double r, int color)
    {
        if (!Mats.TryGetValue(color, out var mat))
        {
            mat = new StandardMaterial3D
            {
                ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded,
                AlbedoColor = M.Col(color),
            };
            Mats[color] = mat;
        }
        // a sphere with 4 segments and a single ring (poles + equator) is exactly an octahedron
        var mesh = new SphereMesh
        {
            Radius = (float)r,
            Height = (float)(r * 2),
            RadialSegments = 4,
            Rings = 1,
        };
        return new MeshInstance3D
        {
            Mesh = mesh,
            MaterialOverride = mat,
            CastShadow = GeometryInstance3D.ShadowCastingSetting.Off,
        };
    }
}

public partial class NpcManager : Node3D
{
    const int MAX_AMBIENT = 42;
    const double SPAWN_RADIUS = 110;
    const double DESPAWN_RADIUS = 150;

    readonly World _world;
    Era _era;
    List<Npc> _npcs = new();
    List<Npc> _quest = new();
    readonly Rng _rng = new(12345);
    double _spawnCooldown = 0;
    readonly List<Collider> _tmp = new();
    double _time = 0;

    public NpcManager() { }

    public NpcManager(World world, Era era)
    {
        Name = "NpcManager";
        _world = world;
        _era = era;
    }

    public void SetEra(Era era)
    {
        _era = era;
        foreach (var n in _npcs) Remove(n);
        _npcs = new List<Npc>();
        ClearQuestNpcs();
    }

    public void ClearQuestNpcs()
    {
        foreach (var n in _quest) Remove(n);
        _quest = new List<Npc>();
    }

    public void SetQuestNpcs(List<QuestNpcSpec> specs)
    {
        ClearQuestNpcs();
        foreach (var s in specs)
        {
            var n = new Npc(s.Look, s.Name, s.X, s.Z, s.Id, s.Kind == "object", _era.Id, 0);
            n.Y = _world.GroundY(s.X, s.Z);
            n.Group.Position = new Vector3((float)n.X, (float)n.Y, (float)n.Z);
            AddChild(n.Group);
            _quest.Add(n);
        }
    }

    void Remove(Npc n)
    {
        if (GodotObject.IsInstanceValid(n.Group))
        {
            if (n.Group.GetParent() == this) RemoveChild(n.Group);
            n.Group.QueueFree();
        }
        n.Figure?.QueueFree();
    }

    public IReadOnlyList<Npc> All
    {
        get
        {
            var all = new List<Npc>(_npcs.Count + _quest.Count);
            all.AddRange(_npcs);
            all.AddRange(_quest);
            return all;
        }
    }

    public Npc Nearest(double px, double pz, double radius)
    {
        Npc best = null;
        double bd = radius;
        foreach (var n in All)
        {
            double d = M.Hypot(n.X - px, n.Z - pz);
            if (d < bd)
            {
                bd = d;
                best = n;
            }
        }
        return best;
    }

    /// <summary>Make an NPC stop and face the player.</summary>
    public void Engage(Npc n, double px, double pz)
    {
        n.Talking = 2.5;
        n.Yaw = Math.Atan2(px - n.X, pz - n.Z);
        if (n.Figure != null) n.Group.Rotation = new Vector3(n.Group.Rotation.X, (float)n.Yaw, n.Group.Rotation.Z);
    }

    public void Update(double dt, double px, double pz)
    {
        if (_era == null || _world == null) return;
        _time += dt;
        // despawn
        for (int i = _npcs.Count - 1; i >= 0; i--)
        {
            var n = _npcs[i];
            if (M.Hypot(n.X - px, n.Z - pz) > DESPAWN_RADIUS)
            {
                Remove(n);
                _npcs.RemoveAt(i);
            }
        }
        // spawn
        _spawnCooldown -= dt;
        int want = (int)M.Round(MAX_AMBIENT * _era.NpcDensity);
        if (_npcs.Count < want && _spawnCooldown <= 0)
        {
            _spawnCooldown = 0.12;
            TrySpawn(px, pz);
        }
        // move
        foreach (var n in _npcs) Step(n, dt, px, pz);
        foreach (var n in _quest)
        {
            if (n.Talking > 0) n.Talking -= dt;
            var m = n.MarkerMesh;
            if (m != null && GodotObject.IsInstanceValid(m))
            {
                m.Rotation = new Vector3(m.Rotation.X, (float)(m.Rotation.Y + dt * 2), m.Rotation.Z);
                m.Position = new Vector3(m.Position.X, (float)((n.IsObject ? 1.2 : 2.5) + Math.Sin(_time * 3) * 0.12), m.Position.Z);
            }
            n.Figure?.Animate(dt, 0);
        }
    }

    void TrySpawn(double px, double pz)
    {
        // the world has no street pattern until it is initialised
        if (_world?.Pattern == null) return;
        double a = _rng.Range(0, Math.PI * 2);
        double r = _rng.Range(35, SPAWN_RADIUS);
        double sx = px + Math.Cos(a) * r;
        double sz = pz + Math.Sin(a) * r;
        double cx = Math.Floor(sx / Macro.CHUNK_SIZE) * Macro.CHUNK_SIZE;
        double cz = Math.Floor(sz / Macro.CHUNK_SIZE) * Macro.CHUNK_SIZE;
        var nodes = _world.Pattern.NodesInRect(cx, cz, cx + Macro.CHUNK_SIZE, cz + Macro.CHUNK_SIZE);
        if (nodes == null || nodes.Count == 0) return;
        var node = _rng.Pick(nodes);
        if (Macro.IsWater(node.X, node.Z) || Macro.SiteClearance(node.X, node.Z) != null) return;
        if (_world.LoadedChunkCount == 0) return;
        if (_era.Npcs == null || _era.Npcs.Length == 0) return;
        var arch = _rng.Weighted(_era.Npcs, k => k.Weight);
        string name = arch.Names[(int)Math.Floor(Hash.Hash2(M.Round(node.X), M.Round(node.Z), 3) * arch.Names.Length)];
        var n = new Npc(arch, name, node.X, node.Z, null, false, _era.Id, (int)Math.Floor(Hash.Hash2(M.Round(node.X), M.Round(node.Z), 7) * Cast.VARIANTS));
        n.Current = node;
        n.Y = _world.GroundY(n.X, n.Z);
        n.Yaw = _rng.Range(0, Math.PI * 2);
        n.Group.Position = new Vector3((float)n.X, (float)n.Y, (float)n.Z);
        AddChild(n.Group);
        _npcs.Add(n);
    }

    void Step(Npc n, double dt, double px, double pz)
    {
        if (n.Talking > 0)
        {
            n.Talking -= dt;
            n.Figure?.Animate(dt, 0);
            return;
        }
        if (n.Idle > 0)
        {
            n.Idle -= dt;
            n.Figure?.Animate(dt, 0);
            return;
        }
        if (n.Target == null)
        {
            if (n.Current == null) return;
            var nb = new List<StreetNode>();
            foreach (var k in _world.Pattern.Neighbors(n.Current))
                if (!Macro.IsWater(k.X, k.Z)) nb.Add(k);
            if (nb.Count == 0)
            {
                n.Idle = 2;
                return;
            }
            n.Target = _rng.Pick(nb);
            if (_rng.Chance(0.25)) n.Idle = _rng.Range(1, 4);
        }
        double dx = n.Target.X - n.X;
        double dz = n.Target.Z - n.Z;
        double d = M.Hypot(dx, dz);
        if (d < 0.8)
        {
            n.Current = n.Target;
            n.Target = null;
            return;
        }
        double wantYaw = Math.Atan2(dx, dz);
        n.Yaw = M.AngleLerp(n.Yaw, wantYaw, Math.Min(1, dt * 6));
        const double sp = 1.4;
        double nx = n.X + Math.Sin(n.Yaw) * sp * dt;
        double nz = n.Z + Math.Cos(n.Yaw) * sp * dt;
        // keep out of buildings and the player
        var cols = _world.CollidersNear(nx, nz, 1, _tmp);
        foreach (var c in cols)
        {
            if ((c.Top != null ? Collision.TopAt(c, nx, nz) > n.Y + Collision.STEP_UP : c.H > 0.5) && Collision.PointIn(c, nx, nz, 0.35))
            {
                n.Idle = 0.6;
                n.Target = null;
                return;
            }
        }
        if (M.Hypot(nx - px, nz - pz) < 0.9)
        {
            nx = n.X;
            nz = n.Z;
        }
        n.X = nx;
        n.Z = nz;
        n.Y = _world.GroundY(n.X, n.Z, n.Y);
        n.Group.Position = new Vector3((float)n.X, (float)n.Y, (float)n.Z);
        n.Group.Rotation = new Vector3(n.Group.Rotation.X, (float)n.Yaw, n.Group.Rotation.Z);
        n.Figure?.Animate(dt, sp);
    }
}
