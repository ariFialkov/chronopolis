using System;
using System.Collections.Generic;
using Godot;

namespace Chronopolis;

/// <summary>
/// Developer scene (port of src/dev/lineup.ts): shows an era's player outfit and its townspeople side by
/// side, like the character sheet. User args after `--`: --era=roman --yaw=0.6 --walk --variant=1 --zoom
/// --shot=/path.png (saves a screenshot after ~30 frames and quits).
/// </summary>
public partial class Lineup : Node3D
{
    readonly List<(string Name, Character C)> _people = new();
    bool _walk;
    string _shot;
    int _frames;
    Camera3D _camera;
    Control _labels;

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
        string eraId = args.GetValueOrDefault("era", "industrial");
        double yaw = double.Parse(args.GetValueOrDefault("yaw", "0"), System.Globalization.CultureInfo.InvariantCulture);
        _walk = args.GetValueOrDefault("walk", "0") == "1";
        int variant = int.Parse(args.GetValueOrDefault("variant", "0"));
        bool zoom = args.GetValueOrDefault("zoom", "0") == "1";
        _shot = args.GetValueOrDefault("shot", null);
        var era = GameData.GetEra(eraId);
        var cast = GameData.Cast[eraId];

        // sky, lights, ground
        var env = new Godot.Environment
        {
            BackgroundMode = Godot.Environment.BGMode.Color,
            BackgroundColor = M.Col(era.Sky),
            AmbientLightSource = Godot.Environment.AmbientSource.Color,
            AmbientLightColor = new Color(0.93f, 0.9f, 0.86f),
            AmbientLightEnergy = 0.3f,
            ReflectedLightSource = Godot.Environment.ReflectionSource.Disabled,
            TonemapMode = Godot.Environment.ToneMapper.Linear,
        };
        AddChild(new WorldEnvironment { Environment = env });
        var sun = new DirectionalLight3D
        {
            LightEnergy = 0.95f,
            ShadowEnabled = true,
            DirectionalShadowMaxDistance = 30,
        };
        AddChild(sun);
        sun.LookAtFromPosition(new Vector3(3, 8, 6), Vector3.Zero, Vector3.Up);
        var ground = new MeshInstance3D
        {
            Mesh = new PlaneMesh { Size = new Vector2(40, 40) },
            MaterialOverride = new StandardMaterial3D { AlbedoColor = M.Col(0x8a8070), Roughness = 1f, MetallicSpecular = 0f, DiffuseMode = BaseMaterial3D.DiffuseModeEnum.Lambert },
        };
        AddChild(ground);

        _people.Add(("Player", new Character(cast.Player)));
        var npcByOutfit = new Dictionary<string, string>();
        foreach (var n in era.Npcs) npcByOutfit[n.Outfit] = n.Role;
        foreach (var (key, outfit) in cast.Roles)
        {
            if (!npcByOutfit.ContainsKey(key)) continue;
            _people.Add(($"{key} ({npcByOutfit[key]})", new Character(Cast.VaryOutfit(outfit, variant))));
        }
        const double gap = 1.15;
        for (int i = 0; i < _people.Count; i++)
        {
            var c = _people[i].C;
            c.Root.Position = new Vector3((float)((i - (_people.Count - 1) / 2.0) * gap), 0, 0);
            c.Root.Rotation = new Vector3(0, (float)yaw, 0);
            AddChild(c.Root);
        }

        _camera = new Camera3D { Fov = 30, Near = 0.1f, Far = 100 };
        AddChild(_camera);
        _camera.LookAtFromPosition(new Vector3(0, zoom ? 1.65f : 1.15f, zoom ? 3.4f : 6.6f), new Vector3(0, zoom ? 1.55f : 1.0f, 0), Vector3.Up);
        _camera.MakeCurrent();

        // overlay: era buttons, title, labels
        var ui = new CanvasLayer();
        AddChild(ui);
        var nav = new HFlowContainer { Position = new Vector2(12, 12), Size = new Vector2(760, 60) };
        nav.AddThemeConstantOverride("h_separation", 6);
        nav.AddThemeConstantOverride("v_separation", 6);
        ui.AddChild(nav);
        var navBox = new StyleBoxFlat { BgColor = new Color(0, 0, 0, 0.27f), CornerRadiusTopLeft = 4, CornerRadiusTopRight = 4, CornerRadiusBottomLeft = 4, CornerRadiusBottomRight = 4, ContentMarginLeft = 6, ContentMarginRight = 6, ContentMarginTop = 3, ContentMarginBottom = 3 };
        foreach (var e in GameData.Eras)
        {
            var l = new Label { Text = e.Id };
            l.AddThemeFontSizeOverride("font_size", 12);
            l.AddThemeStyleboxOverride("normal", navBox);
            nav.AddChild(l);
        }
        var title = new Label
        {
            Text = $"{era.Name} ({era.YearLabel})",
            HorizontalAlignment = HorizontalAlignment.Center,
        };
        title.AddThemeFontSizeOverride("font_size", 22);
        title.SetAnchorsPreset(Control.LayoutPreset.TopWide);
        title.OffsetTop = 64;
        ui.AddChild(title);
        _labels = new Control();
        _labels.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        _labels.MouseFilter = Control.MouseFilterEnum.Ignore;
        ui.AddChild(_labels);
        foreach (var (name, _) in _people)
        {
            var l = new Label { Text = name.ToUpperInvariant(), HorizontalAlignment = HorizontalAlignment.Center };
            l.AddThemeFontSizeOverride("font_size", 14);
            _labels.AddChild(l);
        }
    }

    public override void _Process(double delta)
    {
        double dt = Math.Min(0.05, delta);
        foreach (var (_, c) in _people) c.Animate(dt, _walk ? 1.4 : 0);

        var vp = GetViewport().GetVisibleRect().Size;
        for (int i = 0; i < _people.Count; i++)
        {
            var l = (Label)_labels.GetChild(i);
            var p = _camera.UnprojectPosition(_people[i].C.Root.GlobalPosition);
            var size = l.GetCombinedMinimumSize();
            l.Position = new Vector2(p.X - size.X / 2, vp.Y - 18 - 20);
        }

        _frames++;
        if (_shot != null && _frames == 30)
        {
            var img = GetViewport().GetTexture().GetImage();
            img.SavePng(_shot);
            GD.Print($"lineup: saved {_shot}");
            GetTree().Quit();
        }
    }
}
