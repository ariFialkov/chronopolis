using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Godot;

namespace Chronopolis;

/// <summary>
/// The game: owns the world, player, NPCs, chronoports, quests and UI, and runs the per-frame loop.
/// Port of src/game.ts.
/// </summary>
public partial class Game : Node3D, IQuestContext
{
    static readonly (double X, double Z) START = (160, 438); // the Docks waterfront, 1938

    GameInput _input;
    GameUI _ui;
    CameraRig _cam;
    Atmosphere _atmo;
    World _world;
    Player _player;
    NpcManager _npcs;
    ChronoportManager _ports;
    QuestManager _quests;
    Era _era;
    string _quality;
    readonly Dictionary<string, ImageTexture> _mapCache = new();
    HashSet<string> _discovered = new(), _hints = new(), _insights = new(), _flags = new();
    double _playtime;
    string _mode = "title"; // title | play | busy
    long _frame;
    double _autosaveT, _statsT;
    readonly List<Collider> _colTmp = new();
    readonly Random _rand = new();
    Dictionary<string, string> _args;

    // ---------------- IQuestContext ----------------
    public string EraId => _era.Id;
    public double PlayerX => _player.X;
    public double PlayerZ => _player.Z;
    public HashSet<string> Discovered => _discovered;
    public HashSet<string> Insights => _insights;
    public HashSet<string> Flags => _flags;
    public HashSet<string> Hints => _hints;
    public void Notify(string text) => _ui.Notify(text);
    public void OnQuestsChanged() => RefreshQuestNpcs();

    public override void _Ready()
    {
        GameData.Load();
        _args = ParseArgs();
        _input = new GameInput();
        _quality = _args.GetValueOrDefault("quality", null) ?? SaveSystem.LoadQuality() ?? "high";

        _atmo = new Atmosphere();
        AddChild(_atmo);
        var camera = new Camera3D { Name = "Camera" };
        AddChild(camera);
        camera.Current = true;
        _cam = new CameraRig(camera);

        _era = GameData.GetEra(GameData.HomeEraId);
        var q = QualityPreset.Get(_quality);
        _world = new World { Name = "World" };
        AddChild(_world);
        _world.Init(_era, new WorldQuality { NearRadius = q.NearRadius, FarRadius = q.FarRadius });
        _atmo.SetEra(_era);
        _atmo.ApplyQuality(q, GetViewport());
        _player = new Player();
        AddChild(_player);
        _npcs = new NpcManager(_world, _era) { Name = "Npcs" };
        AddChild(_npcs);
        _ports = new ChronoportManager(_world);
        AddChild(_ports);
        _quests = new QuestManager(this);

        _ui = new GameUI();
        AddChild(_ui);
        _ui.DevKeyEnabled = false;
        _ui.DevVisible = !_args.ContainsKey("nodev"); // test builds keep the dev panel (toggle with `)
        _ui.OnJournalClose = () => _ui.CloseJournal();
        _ui.OnPauseResume = () => _ui.ClosePause();
        _ui.OnPauseSave = () =>
        {
            Save();
            _ui.Notify("Game saved.");
        };
        _ui.OnPauseQuality = CycleQuality;
        _ui.OnPauseQuit = () =>
        {
            Save();
            _ui.ClosePause();
            ShowTitle();
        };
        _ui.OnDevTravel = id => _ = DebugTravel(id);
        _ui.SetQualityLabel(_quality);

        // the city behind the title screen
        _player.Teleport(START.X, START.Z, _world);
        _player.Visible = false;
        _cam.SnapTo(START.X, _player.Y, START.Z);
        _cam.Yaw = 0.35;
        _cam.Pitch = 0.3;
        _cam.SetDistance(16);
        _world.Warmup(START.X, START.Z);
        _ports.RefreshHeights(_world);

        if (_args.ContainsKey("smoke")) _ = Smoke();
        else if (_args.ContainsKey("era")) _ = NewGame(_args["era"]);
        else ShowTitle();
    }

    static Dictionary<string, string> ParseArgs()
    {
        var args = new Dictionary<string, string>();
        foreach (string a in OS.GetCmdlineUserArgs())
        {
            string s = a.TrimStart('-');
            int eq = s.IndexOf('=');
            if (eq >= 0) args[s[..eq]] = s[(eq + 1)..];
            else args[s] = "1";
        }
        return args;
    }

    public override void _Notification(int what)
    {
        if (what == NotificationApplicationFocusOut) _input.ClearKeys();
        if (what == NotificationWMCloseRequest) Save();
    }

    public override void _Input(InputEvent e)
    {
        _input.Handle(e);
        // F11 / Alt+Enter / Cmd+Ctrl+F: fullscreen
        if (e is InputEventKey { Pressed: true, Echo: false } k && (k.Keycode == Key.F11 || (k.Keycode == Key.Enter && k.AltPressed) || (k.Keycode == Key.F && k.MetaPressed && k.CtrlPressed)))
        {
            bool full = DisplayServer.WindowGetMode() is DisplayServer.WindowMode.Fullscreen or DisplayServer.WindowMode.ExclusiveFullscreen;
            DisplayServer.WindowSetMode(full ? DisplayServer.WindowMode.Windowed : DisplayServer.WindowMode.Fullscreen);
        }
        // click into the game to capture the mouse for looking around
        if (e is InputEventMouseButton { Pressed: true, ButtonIndex: MouseButton.Left } mb && _mode == "play" && !_ui.DialogueOpen && !_ui.JournalOpen && !_ui.PauseOpen && !_ui.PointerOverUI(mb.Position))
            _input.Capture();
    }

    // ---------------- quality ----------------

    void CycleQuality()
    {
        var order = QualityPreset.Order;
        _quality = order[(Array.IndexOf(order, _quality) + 1) % order.Length];
        SaveSystem.SaveQuality(_quality);
        var q = QualityPreset.Get(_quality);
        _atmo.ApplyQuality(q, GetViewport());
        _world.Quality = new WorldQuality { NearRadius = q.NearRadius, FarRadius = q.FarRadius };
        _ui.SetQualityLabel(_quality);
    }

    // ---------------- flow ----------------

    void ShowTitle()
    {
        _mode = "title";
        _input.Release();
        _input.Blocked = true;
        var save = SaveSystem.Load();
        _ui.ShowTitle(save != null, () => _ = NewGame(null), () => { if (save != null) _ = ContinueGame(save); });
    }

    async Task NewGame(string eraOverride)
    {
        SaveSystem.Clear();
        _discovered = new HashSet<string>();
        _hints = new HashSet<string>();
        _insights = new HashSet<string>();
        _flags = new HashSet<string>();
        _playtime = 0;
        _quests = new QuestManager(this);
        _quests.Load(new QuestState());
        _quests.Init();
        _ui.HideTitle();
        var era = GameData.GetEra(eraOverride ?? GameData.HomeEraId);
        double x = START.X, z = START.Z;
        if (eraOverride != null && era.Chronoport != null)
        {
            x = era.Chronoport.X + 6;
            z = era.Chronoport.Z + 5;
        }
        await EnterEra(era, x, z, true);
        _cam.Yaw = Math.PI;
        _ui.Notify("1938. The Docks. Danny is shouting about Austria again.");
    }

    async Task ContinueGame(SaveData s)
    {
        _discovered = new HashSet<string>(s.Discovered);
        _hints = new HashSet<string>(s.Hints);
        _insights = new HashSet<string>(s.Insights);
        _flags = new HashSet<string>(s.Flags);
        _playtime = s.Playtime;
        _quests = new QuestManager(this);
        _quests.Load(s.Quests ?? new QuestState());
        _quests.Init();
        _ui.HideTitle();
        var era = GameData.Eras.FirstOrDefault(e => e.Id == s.Era) ?? GameData.GetEra(GameData.HomeEraId);
        await EnterEra(era, s.X, s.Z, true);
        _player.Yaw = s.Yaw;
        _cam.Yaw = s.CamYaw;
    }

    ImageTexture MapFor(Era era)
    {
        if (!_mapCache.TryGetValue(era.Id, out var m))
        {
            m = MapImage.RenderEraMap(era);
            _mapCache[era.Id] = m;
        }
        return m;
    }

    /// <summary>Switch the world to an era and place the player. Shows the loading screen.</summary>
    async Task EnterEra(Era era, double x, double z, bool initial)
    {
        _mode = "busy";
        _input.Blocked = true;
        _ui.ShowLoading(initial ? "Building the city..." : $"Rebuilding the city for {era.YearLabel}...");
        await _ui.NextFrame();
        await _ui.NextFrame();
        bool changed = _era != era || initial;
        _era = era;
        if (changed && (_world.Era != era || _world.LoadedChunkCount == 0)) _world.SetEra(era);
        _atmo.SetEra(era);
        _ports.RefreshHeights(_world);
        _npcs.SetEra(era);
        _player.SetEra(era.Id);
        _player.Visible = true;
        _player.Teleport(x, z, _world);
        _cam.SnapTo(x, _player.Y, z);
        if (initial)
        {
            _cam.SetDistance(7.5);
            _cam.Pitch = 0.32;
        }
        _world.Warmup(x, z);
        _player.Teleport(x, z, _world);
        MapFor(era);
        _ui.SetEra(era);
        _ui.SetDistrict(era, x, z);
        RefreshQuestNpcs();
        _quests.Update();
        _ui.HideLoading();
        _mode = "play";
        _input.Blocked = false;
        _autosaveT = 0;
    }

    void RefreshQuestNpcs() => _npcs.SetQuestNpcs(_quests.QuestNpcs());

    async Task Travel(string targetEraId, double arriveX, double arriveZ)
    {
        var era = GameData.GetEra(targetEraId);
        _mode = "busy";
        _input.Blocked = true;
        _input.Release();
        Save();
        await _ui.PlayTransition(era, async () =>
        {
            await EnterEra(era, arriveX, arriveZ, false);
            _mode = "busy";
            _input.Blocked = true;
        });
        _mode = "play";
        _input.Blocked = false;
        _quests.Update();
        Save();
    }

    public void Save()
    {
        if (_mode == "title" || _quests == null) return;
        SaveSystem.Write(new SaveData
        {
            Era = _era.Id,
            X = _player.X,
            Z = _player.Z,
            Yaw = _player.Yaw,
            CamYaw = _cam.Yaw,
            Discovered = _discovered.ToList(),
            Hints = _hints.ToList(),
            Insights = _insights.ToList(),
            Flags = _flags.ToList(),
            Quests = _quests.State,
            Playtime = _playtime,
            Quality = _quality,
            SavedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        });
    }

    // ---------------- frame loop ----------------

    public override void _Process(double delta)
    {
        double dt = Math.Min(0.05, delta);
        _frame++;
        _input.Poll(dt);
        if (_input.DevToggle) _ui.ToggleDev();
        if (_mode == "play") UpdatePlay(dt);
        else
        {
            if (_mode == "title")
            {
                // slow idle orbit behind the title screen
                _cam.Yaw += dt * 0.05;
            }
            _world.UpdateStreaming(_player.X, _player.Z, 1);
            _cam.Update(_player.X, _player.Y, _player.Z, dt, _colTmp, (x, z) => _world.GroundY(x, z));
            _ports.Step(dt, _era, GameData.HomeEraId);
        }
        _statsT += delta;
        if (_statsT >= 0.5 && _ui.DevVisible)
        {
            _statsT = 0;
            var rs = RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalPrimitivesInFrame);
            var calls = RenderingServer.GetRenderingInfo(RenderingServer.RenderingInfo.TotalDrawCallsInFrame);
            _ui.SetDevStats($"{Engine.GetFramesPerSecond():0} fps · {rs / 1000}k tris · {calls} calls · {_world.LoadedChunkCount} chunks · {_quality} · {_era.Id} ({_player.X:0}, {_player.Z:0})");
        }
        _input.EndFrame();
    }

    List<Collider> CamColliders() => _world.CollidersNear(_player.X, _player.Z, 20, _colTmp);

    void UpdatePlay(double dt)
    {
        var s = _input;
        var ui = _ui;
        // overlays
        if (ui.DialogueOpen)
        {
            s.Blocked = true;
            if (s.Interact || s.Pause || s.Jump) ui.AdvanceDialogue();
            _cam.Update(_player.X, _player.Y, _player.Z, dt, CamColliders(), (x, z) => _world.GroundY(x, z));
            _npcs.Update(dt, _player.X, _player.Z);
            _ports.Step(dt, _era, GameData.HomeEraId);
            _player.Idle(dt);
            return;
        }
        if (ui.JournalOpen)
        {
            s.Blocked = true;
            if (s.Map || s.Pause) ui.CloseJournal();
            return;
        }
        if (ui.PauseOpen)
        {
            s.Blocked = true;
            if (s.Pause) ui.ClosePause();
            return;
        }
        s.Blocked = false;
        if (s.Map)
        {
            _input.Release();
            ui.OpenJournal(JournalData());
            return;
        }
        if (s.Pause)
        {
            _input.Release();
            ui.OpenPause(_quality);
            return;
        }

        _playtime += dt;
        _autosaveT += dt;
        if (_autosaveT > 20)
        {
            _autosaveT = 0;
            Save();
        }

        _cam.Rotate(s.LookX, s.LookY);
        if (s.Zoom != 0) _cam.ZoomBy(s.Zoom);
        _player.Step(dt, s.MoveX, s.MoveY, s.Sprint, s.Jump, _cam.Forward(), _world);
        _world.UpdateStreaming(_player.X, _player.Z, 3);
        _npcs.Update(dt, _player.X, _player.Z);
        _ports.Step(dt, _era, GameData.HomeEraId);
        _quests.Update();

        // chronoport discovery
        var near = _ports.Nearest(_player.X, _player.Z, ChronoportManager.NOTICE_RADIUS);
        if (near != null && !_discovered.Contains(near.Era.Id))
        {
            _discovered.Add(near.Era.Id);
            ui.Notify($"Chronoport discovered: {near.Era.Civ}, {near.Era.YearLabel}. Recorded in your journal.");
            _quests.Update();
            Save();
        }

        // interaction prompt
        string prompt = null;
        Action action = null;
        var qn = _npcs.Nearest(_player.X, _player.Z, 2.8);
        var port = _ports.Nearest(_player.X, _player.Z, ChronoportManager.USE_RADIUS);
        if (qn != null && qn.QuestId != null)
        {
            var d = _quests.LinesFor(qn.QuestId);
            if (d != null)
            {
                var lines = d.Value;
                prompt = qn.IsObject ? $"E: Read {qn.Name}" : $"E: Talk to {qn.Name}";
                action = async () =>
                {
                    _npcs.Engage(qn, _player.X, _player.Z);
                    _input.Release();
                    string id = qn.QuestId;
                    await ui.ShowDialogue(qn.IsObject ? qn.Name : $"{qn.Name}, {qn.Role}", lines.Lines);
                    _quests.CompleteInteraction(lines.QuestId != null && id != null ? id : "");
                };
            }
        }
        if (prompt == null && port != null)
        {
            bool active = ChronoportManager.IsActive(port, _era, GameData.HomeEraId);
            var dest = _era.Id == port.Era.Id ? GameData.GetEra(GameData.HomeEraId) : port.Era;
            prompt = active ? $"E: Enter the chronoport to {dest.YearLabel}" : $"The ring is cold. It opens only from 1938 or from {port.Era.YearLabel}.";
            if (active)
            {
                var p = port.Era.Chronoport;
                action = () => _ = Travel(dest.Id, p.X + 6, p.Z + 5);
            }
        }
        if (prompt == null && qn != null && qn.QuestId == null)
        {
            prompt = $"E: Talk to {qn.Name}";
            action = () =>
            {
                _npcs.Engage(qn, _player.X, _player.Z);
                string line = qn.Lines[_rand.Next(qn.Lines.Length)];
                // ambient NPCs occasionally drop a chronoport rumour
                string rumour = PickRumour();
                _ = ui.ShowDialogue($"{qn.Name}, {qn.Role}", rumour != null && _rand.NextDouble() < 0.18 ? new[] { line, rumour } : new[] { line });
            };
        }
        ui.SetPrompt(prompt);
        if (s.Interact && action != null) action();

        // HUD
        var tq = _quests.TrackedQuest();
        if (tq != null) ui.SetObjective(tq.Title, _quests.CurrentStep(tq).Objective);
        else ui.SetObjective("Free roam", "Explore the city. Find the remaining doors.");
        if (_frame % 3 == 0)
        {
            var marker = tq != null ? _quests.MarkerFor(tq) : null;
            var pins = GameData.ChronoportEras.Where(e => _discovered.Contains(e.Id) || _hints.Contains(e.Id))
                .Select(e => new PortPin { X = e.Chronoport.X, Z = e.Chronoport.Z, Found = _discovered.Contains(e.Id) }).ToList();
            ui.DrawMinimap(MapFor(_era), _player.X, _player.Z, _cam.Yaw, marker, _era.Id, pins);
        }
        if (_frame % 30 == 0) ui.SetDistrict(_era, _player.X, _player.Z);

        _cam.Update(_player.X, _player.Y, _player.Z, dt, CamColliders(), (x, z) => _world.GroundY(x, z));
    }

    string PickRumour()
    {
        if (_era.Id != GameData.HomeEraId) return null;
        var unknown = GameData.ChronoportEras.Where(e => !_discovered.Contains(e.Id) && !_hints.Contains(e.Id)).ToList();
        if (unknown.Count == 0) return null;
        var e = unknown[_rand.Next(unknown.Count)];
        _hints.Add(e.Id);
        _ui.Notify($"Journal updated: a rumour about a door ({e.YearLabel}).");
        return $"You want to know about the old doors? {e.Chronoport.Hint} Do not tell the Bureau I said so.";
    }

    JournalData JournalData()
    {
        var q = _quests.TrackedQuest();
        return new JournalData
        {
            Era = _era,
            MapImage = MapFor(_era),
            PlayerX = _player.X,
            PlayerZ = _player.Z,
            PlayerYaw = _cam.Yaw,
            Marker = q != null ? _quests.MarkerFor(q) : null,
            Discovered = _discovered,
            Hints = _hints,
            Insights = _insights,
            Quests = _quests,
        };
    }

    // ---------------- debug ----------------

    /// <summary>Jump straight to an era (dev panel buttons).</summary>
    public Task DebugTravel(string eraId)
    {
        if (_mode != "play") return Task.CompletedTask;
        var e = GameData.GetEra(eraId);
        double px = e.Chronoport != null ? e.Chronoport.X + 6 : START.X;
        double pz = e.Chronoport != null ? e.Chronoport.Z + 5 : START.Z;
        return Travel(eraId, px, pz);
    }

    /// <summary>
    /// Automated smoke test (run with `-- --smoke --shots=/dir`): starts a new game, walks, talks,
    /// opens the journal, travels through a chronoport, and saves screenshots along the way.
    /// </summary>
    async Task Smoke()
    {
        string dir = _args.GetValueOrDefault("shots", "user://smoke");
        DirAccess.MakeDirRecursiveAbsolute(dir);
        async Task Frames(int n) { for (int i = 0; i < n; i++) await _ui.NextFrame(); }
        void Shot(string name)
        {
            GetViewport().GetTexture().GetImage().SavePng($"{dir}/{name}.png");
            GD.Print($"smoke: {name} era={_era.Id} pos=({_player.X:0.0},{_player.Y:0.0},{_player.Z:0.0}) chunks={_world.LoadedChunkCount} npcs={_npcs.All.Count} mode={_mode}");
        }
        ShowTitle();
        await Frames(20);
        Shot("01_title");
        await NewGame(null);
        await Frames(30);
        Shot("02_start");
        // walk forward for a while
        double t0 = Time.GetTicksMsec();
        _cam.Yaw = Math.PI;
        for (int i = 0; i < 60; i++)
        {
            _player.Step(0.05, 0, 1, true, false, _cam.Forward(), _world);
            _world.UpdateStreaming(_player.X, _player.Z, 3);
            _cam.Update(_player.X, _player.Y, _player.Z, 0.05, CamColliders(), (x, z) => _world.GroundY(x, z));
            await _ui.NextFrame();
        }
        Shot("03_walked");
        _ui.OpenJournal(JournalData());
        await Frames(5);
        Shot("04_journal");
        _ui.CloseJournal();
        _ = _ui.ShowDialogue("Danny, newsboy", new[] { "Extra, extra! Read all about it!" });
        await Frames(60);
        Shot("05_dialogue");
        _ui.AdvanceDialogue();
        _ui.AdvanceDialogue();
        await Frames(5);
        foreach (var id in _args.GetValueOrDefault("eras", "roman,egyptian,sengoku").Split(','))
        {
            await DebugTravel(id);
            await Frames(20);
            Shot($"06_{id}");
        }
        GD.Print($"smoke: done in {(Time.GetTicksMsec() - t0) / 1000:0.0}s");
        GetTree().Quit();
    }
}
