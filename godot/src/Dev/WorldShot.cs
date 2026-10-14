using System;
using System.Collections.Generic;
using System.Globalization;
using Godot;

namespace Chronopolis;

/// <summary>
/// Developer scene: builds an era around a point and renders it from an orbit camera, optionally with
/// NPCs and the player. User args after `--`: --era=roman --x=0 --z=0 --yaw=0.6 --pitch=0.3 --dist=40
/// --quality=high --frames=40 --shot=/path.png (saves and quits).
/// </summary>
public partial class WorldShot : Node3D
{
    string _shot;
    int _frames, _target;
    World _world;
    NpcManager _npcs;
    double _x, _z;

    public override void _Ready()
    {
        GameData.Load();
        var args = new Dictionary<string, string>();
        foreach (string a in OS.GetCmdlineUserArgs())
        {
            string s = a.TrimStart('-');
            int eq = s.IndexOf('=');
            if (eq >= 0) args[s[..eq]] = s[(eq + 1)..];
            else args[s] = "1";
        }
        double D(string k, double d) => args.TryGetValue(k, out var v) ? double.Parse(v, CultureInfo.InvariantCulture) : d;
        var era = GameData.GetEra(args.GetValueOrDefault("era", GameData.HomeEraId));
        var q = QualityPreset.Get(args.GetValueOrDefault("quality", "high"));
        _x = D("x", 160);
        _z = D("z", 438);
        _shot = args.GetValueOrDefault("shot", null);
        _target = (int)D("frames", 40);

        var atmo = new Atmosphere();
        AddChild(atmo);
        atmo.SetEra(era);
        atmo.ApplyQuality(q, GetViewport());
        var env = atmo.WorldEnv.Environment;
        if (args.ContainsKey("nofog")) env.FogEnabled = false;
        if (args.ContainsKey("sun")) atmo.Sun.LightEnergy = (float)(era.SunIntensity * D("sun", 0.62));
        if (args.ContainsKey("amb")) env.AmbientLightEnergy = (float)D("amb", 0.75);
        if (args.ContainsKey("exp")) env.TonemapExposure = (float)D("exp", 1);
        if (args.ContainsKey("tone")) env.TonemapMode = (Godot.Environment.ToneMapper)(int)D("tone", 3);
        _world = new World { Name = "World" };
        AddChild(_world);
        _world.Init(era, new WorldQuality { NearRadius = q.NearRadius, FarRadius = q.FarRadius });
        var t0 = Time.GetTicksMsec();
        _world.Warmup(_x, _z);
        GD.Print($"warmup {Time.GetTicksMsec() - t0} ms, {_world.LoadedChunkCount} chunks, {_world.Triangles} tris");
        GD.Print($"ground={_world.GroundY(_x, _z):F2} terrain={Macro.TerrainHeight(_x, _z):F2} water={Macro.WaterDepth(_x, _z):F2} bld={_world.BuildingsNear(_x, _z, 60).Count}");
        foreach (var n in _world.GetChildren())
            if (n is MeshInstance3D mi && mi.GetIndex() < 8) GD.Print($"  {mi.Name} aabb={mi.GetAabb()} bias={(mi.Mesh.GetSurfaceCount() > 0 && mi.Mesh.SurfaceGetMaterial(0) is ShaderMaterial m0 ? m0.GetShaderParameter("depth_bias").ToString() : "-")} faces={mi.Mesh.GetFaces().Length / 3}");
        foreach (var n in _world.GetChildren())
            if (n is Node3D st && st.Name == "Static")
                foreach (var c in st.GetChildren())
                    if (c is MeshInstance3D smi) GD.Print($"  static {smi.Name} aabb={smi.GetAabb()} faces={smi.Mesh.GetFaces().Length / 3}");
        if (args.ContainsKey("noterrain"))
            foreach (var n in _world.GetChildren())
                if (n is MeshInstance3D mi && mi.Mesh.GetSurfaceCount() > 0 && mi.Mesh.SurfaceGetMaterial(0) is ShaderMaterial sm && (float)sm.GetShaderParameter("depth_bias") > 0) mi.Visible = false;
        if (args.ContainsKey("stdmat"))
            foreach (var n in _world.GetChildren())
                if (n is MeshInstance3D mi && mi.Name != "Water") mi.MaterialOverride = new StandardMaterial3D { VertexColorUseAsAlbedo = true, CullMode = BaseMaterial3D.CullModeEnum.Disabled };
        AddChild(new ChronoportManager(_world));
        _npcs = new NpcManager(_world, era);
        AddChild(_npcs);
        var player = new Player();
        AddChild(player);
        player.SetEra(era.Id);
        player.Teleport(_x, _z, _world);
        var cam = new Camera3D();
        AddChild(cam);
        var rig = new CameraRig(cam) { Yaw = D("yaw", Math.PI), Pitch = D("pitch", 0.32) };
        rig.ZoomBy((D("dist", 7.5) - 7.5) / 1.1);
        rig.Distance = D("dist", 7.5);
        rig.SnapTo(_x, player.Y, _z);
        rig.Update(_x, player.Y, _z, 0.016, new List<Collider>(), (x, z) => _world.GroundY(x, z));
        cam.Current = true;
    }

    public override void _Process(double delta)
    {
        _frames++;
        _world.UpdateStreaming(_x, _z, 4);
        for (int i = 0; i < 4; i++) _npcs.Update(0.05, _x, _z);
        if (_shot != null && _frames == _target)
        {
            GetViewport().GetTexture().GetImage().SavePng(_shot);
            GD.Print($"saved {_shot} chunks={_world.LoadedChunkCount} npcs={_npcs.All.Count}");
            GetTree().Quit();
        }
    }
}
