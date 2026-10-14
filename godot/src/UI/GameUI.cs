using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Godot;

namespace Chronopolis;

/// <summary>
/// All 2D UI: HUD (era label, district, minimap, objective, prompt, toasts), dialogue box, journal
/// (map / objectives / chronoports / insights), pause menu, title screen, era transition card,
/// loading screen and the developer panel. Port of src/ui/ui.ts + src/ui/devtools.ts + the markup
/// in index.html and the look of src/style.css. Everything is built in code.
///
/// Designed for a 1600x900 base canvas with project setting display/window/stretch/mode = canvas_items
/// and aspect = expand. Keyboard / gamepad shortcuts are handled by the game loop; the only key read
/// here is backquote for the dev panel (disable with <see cref="DevKeyEnabled"/>).
/// </summary>
public partial class GameUI : CanvasLayer
{
    // ---------------- palette (style.css :root) ----------------
    static readonly Color Ink = Color.FromHtml("#e9e4d6");
    static readonly Color InkDim = Color.FromHtml("#b9b2a2");
    static readonly Color PanelBg = new(12 / 255f, 14 / 255f, 20 / 255f, 0.82f);
    static readonly Color Accent = Color.FromHtml("#ffd36a");
    static readonly Color Accent2 = Color.FromHtml("#6ad0ff");
    static readonly Color ScreenBg = new(6 / 255f, 8 / 255f, 12 / 255f, 0.86f);
    static readonly Color InnerBg = new(18 / 255f, 21 / 255f, 32 / 255f, 0.97f);
    static readonly Color Hairline = new(1, 1, 1, 0.14f);

    // ---------------- callbacks ----------------
    public Action OnPauseResume, OnPauseSave, OnPauseQuality, OnPauseQuit, OnJournalClose;
    /// <summary>Dev panel era button: receives the era id.</summary>
    public Action<string> OnDevTravel;

    /// <summary>False keeps the minimap north-up with a rotating player arrow (the web version);
    /// true rotates the map so the view direction always points up.</summary>
    public bool MinimapRotates = false;
    /// <summary>When true GameUI toggles the dev panel itself on the backquote key.</summary>
    public bool DevKeyEnabled = true;

    // ---------------- fonts / theme ----------------
    Font _sans, _sansBold, _sansItalic, _serif, _serifItalic;
    Theme _theme;

    // ---------------- nodes ----------------
    Control _root, _hud;
    PanelContainer _eraPanel;
    Label _eraName, _eraYear, _district;
    Control _minimap, _minimapMap, _minimapRing;
    PanelContainer _objective;
    Label _objectiveTitle, _objectiveText;
    PanelContainer _prompt;
    Label _promptLabel;
    VBoxContainer _toasts;

    PanelContainer _dialogue;
    Label _dialogueSpeaker, _dialogueText, _dialogueHint;

    Control _journal;
    readonly Dictionary<string, Button> _tabButtons = new();
    readonly Dictionary<string, Control> _tabPages = new();
    Control _bigmap;
    VBoxContainer _legend, _questsList, _portsList, _insightsList;

    Control _pause;
    Button _pauseResume, _pauseQuality;
    Control _controlsHelp;

    Control _title;
    Button _titleContinue, _titleNew;
    Control _titleButtons, _titleConfirm;
    Action _titleOnNew, _titleOnContinue;
    bool _titleHasSave;

    Control _transition, _transitionCard;
    TextureRect _transitionBg;
    ColorRect _transitionFlash;
    Label _transYear, _transName, _transTag;
    GradientTexture2D _transGradient;

    Control _loading, _spinner;
    Label _loadingText;

    PanelContainer _dev;
    Control _devBody;
    Label _devStats;
    Button _devToggle;
    bool _devOpen = true;

    // ---------------- state ----------------
    string _journalTab = "map";
    JournalData _journalData;
    string[] _dialogueLines = Array.Empty<string>();
    int _dialogueIndex;
    TaskCompletionSource _dialogueTcs;
    float _typePos;
    int _typeTotal;
    bool _typing;
    const float TYPE_SPEED = 55f; // characters per second

    Texture2D _mmTex;
    double _mmX, _mmZ, _mmYaw;
    Marker _mmMarker;
    string _mmEra;
    IList<PortPin> _mmPorts;

    public GameUI()
    {
        Layer = 10;
        ProcessMode = ProcessModeEnum.Always;
        BuildFonts();
        BuildTheme();
        _root = new Control { Name = "UIRoot", MouseFilter = Control.MouseFilterEnum.Ignore, Theme = _theme };
        _root.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        AddChild(_root);
        BuildHud();
        BuildDialogue();
        BuildJournal();
        BuildPause();
        BuildTitle();
        BuildTransition();
        BuildLoading();
        BuildDev();
    }

    // =====================================================================================
    // Fonts and theme
    // =====================================================================================

    void BuildFonts()
    {
        _sans = ThemeDB.FallbackFont;
        _sansBold = new FontVariation { BaseFont = _sans, VariationEmbolden = 0.55f };
        _sansItalic = new FontVariation { BaseFont = _sans, VariationTransform = new Transform2D(new Vector2(1, 0), new Vector2(0.2f, 1), Vector2.Zero) };
        // The web version sets headings in Georgia; use it (or a close system serif) when available,
        // falling back to the default font.
        string[] serifs = { "Georgia", "Palatino Linotype", "Book Antiqua", "Palatino", "Times New Roman", "Liberation Serif", "DejaVu Serif", "serif" };
        var serif = new SystemFont { FontNames = serifs, Fallbacks = new Godot.Collections.Array<Font> { _sans } };
        _serif = serif;
        _serifItalic = new SystemFont { FontNames = serifs, FontItalic = true, Fallbacks = new Godot.Collections.Array<Font> { _sansItalic } };
    }

    static Font Spaced(Font f, int glyph) => new FontVariation { BaseFont = f, SpacingGlyph = glyph };

    static StyleBoxFlat Box(Color bg, float radius = 0, float padX = 0, float padY = 0, Color? border = null, int borderW = 0)
    {
        var sb = new StyleBoxFlat { BgColor = bg, AntiAliasing = true };
        sb.SetCornerRadiusAll((int)radius);
        sb.ContentMarginLeft = sb.ContentMarginRight = padX;
        sb.ContentMarginTop = sb.ContentMarginBottom = padY;
        if (border.HasValue && borderW > 0)
        {
            sb.BorderColor = border.Value;
            sb.SetBorderWidthAll(borderW);
        }
        return sb;
    }

    void BuildTheme()
    {
        var t = new Theme { DefaultFont = _sans, DefaultFontSize = 15 };
        t.SetColor("font_color", "Label", Ink);

        // ----- buttons -----
        void ButtonStyles(string type, StyleBox normal, StyleBox hover, StyleBox pressed, StyleBox disabled, StyleBox focus)
        {
            t.SetStylebox("normal", type, normal);
            t.SetStylebox("hover", type, hover);
            t.SetStylebox("pressed", type, pressed);
            t.SetStylebox("hover_pressed", type, pressed);
            t.SetStylebox("disabled", type, disabled);
            t.SetStylebox("focus", type, focus);
        }
        var focus = new StyleBoxFlat { DrawCenter = false, BorderColor = new Color(Accent, 0.85f), AntiAliasing = true };
        focus.SetBorderWidthAll(2);
        focus.SetCornerRadiusAll(7);
        focus.SetExpandMarginAll(2);
        ButtonStyles("Button",
            Box(new Color(1, 1, 1, 0.055f), 6, 14, 8, new Color(1, 1, 1, 0.28f), 1),
            Box(new Color(Accent, 0.2f), 6, 14, 8, new Color(Accent, 0.6f), 1),
            Box(new Color(Accent, 0.32f), 6, 14, 8, new Color(Accent, 0.8f), 1),
            Box(new Color(1, 1, 1, 0.025f), 6, 14, 8, new Color(1, 1, 1, 0.1f), 1),
            focus);
        t.SetColor("font_color", "Button", Ink);
        t.SetColor("font_hover_color", "Button", Color.FromHtml("#fff6e0"));
        t.SetColor("font_pressed_color", "Button", Accent);
        t.SetColor("font_hover_pressed_color", "Button", Accent);
        t.SetColor("font_focus_color", "Button", Ink);
        t.SetColor("font_disabled_color", "Button", new Color(Ink, 0.35f));
        t.SetFontSize("font_size", "Button", 15);

        // big menu buttons
        t.SetTypeVariation("BigButton", "Button");
        t.SetFontSize("font_size", "BigButton", 16);
        t.SetFont("font", "BigButton", _sans);

        // journal tabs: transparent until active (toggle_mode + ButtonGroup)
        t.SetTypeVariation("TabButton", "Button");
        var tabFocus = (StyleBoxFlat)focus.Duplicate();
        ButtonStyles("TabButton",
            Box(new Color(0, 0, 0, 0), 6, 16, 8),
            Box(new Color(1, 1, 1, 0.06f), 6, 16, 8),
            Box(new Color(Accent, 0.15f), 6, 16, 8),
            Box(new Color(0, 0, 0, 0), 6, 16, 8),
            tabFocus);
        t.SetColor("font_color", "TabButton", InkDim);
        t.SetColor("font_hover_color", "TabButton", Ink);
        t.SetColor("font_pressed_color", "TabButton", Accent);
        t.SetColor("font_hover_pressed_color", "TabButton", Accent);
        t.SetFontSize("font_size", "TabButton", 15);

        // dev era buttons
        t.SetTypeVariation("DevButton", "Button");
        ButtonStyles("DevButton",
            Box(new Color(1, 1, 1, 0.05f), 3, 7, 3),
            Box(new Color(Accent, 0.25f), 3, 7, 3),
            Box(new Color(Accent, 0.4f), 3, 7, 3),
            Box(new Color(1, 1, 1, 0.02f), 3, 7, 3),
            new StyleBoxEmpty());
        t.SetFontSize("font_size", "DevButton", 12);
        t.SetColor("font_color", "DevButton", Ink);
        t.SetColor("font_hover_color", "DevButton", Color.FromHtml("#fff6e0"));
        t.SetColor("font_pressed_color", "DevButton", Accent);

        // ----- panels -----
        t.SetStylebox("panel", "PanelContainer", Box(PanelBg, 8, 16, 12, new Color(1, 1, 1, 0.16f), 1));

        // ----- scrolling -----
        t.SetStylebox("panel", "ScrollContainer", new StyleBoxEmpty());
        var grabber = Box(new Color(1, 1, 1, 0.22f), 4);
        var grabberHi = Box(new Color(Accent, 0.5f), 4);
        var scrollBg = Box(new Color(1, 1, 1, 0.04f), 4);
        scrollBg.ContentMarginLeft = scrollBg.ContentMarginRight = 4;
        t.SetStylebox("scroll", "VScrollBar", scrollBg);
        t.SetStylebox("scroll_focus", "VScrollBar", scrollBg);
        t.SetStylebox("grabber", "VScrollBar", grabber);
        t.SetStylebox("grabber_highlight", "VScrollBar", grabberHi);
        t.SetStylebox("grabber_pressed", "VScrollBar", grabberHi);

        // ----- rich text -----
        t.SetFont("normal_font", "RichTextLabel", _sans);
        t.SetFont("bold_font", "RichTextLabel", _sansBold);
        t.SetFont("italics_font", "RichTextLabel", _sansItalic);
        t.SetColor("default_color", "RichTextLabel", Ink);
        t.SetFontSize("normal_font_size", "RichTextLabel", 14);
        t.SetFontSize("bold_font_size", "RichTextLabel", 14);
        t.SetFontSize("italics_font_size", "RichTextLabel", 14);
        t.SetConstant("line_separation", "RichTextLabel", 3);
        _theme = t;
    }

    // ----- small factories -----

    Label Text(string text, int size, Color color, Font font = null, bool wrap = false, HorizontalAlignment align = HorizontalAlignment.Left)
    {
        var l = new Label { Text = text, HorizontalAlignment = align, MouseFilter = Control.MouseFilterEnum.Ignore };
        l.AddThemeFontSizeOverride("font_size", size);
        l.AddThemeColorOverride("font_color", color);
        if (font != null) l.AddThemeFontOverride("font", font);
        if (wrap) l.AutowrapMode = TextServer.AutowrapMode.WordSmart;
        return l;
    }

    static void Outline(Label l, Color col, int size)
    {
        l.AddThemeColorOverride("font_outline_color", col);
        l.AddThemeConstantOverride("outline_size", size);
    }

    static PanelContainer PanelOf(StyleBox sb, Control.MouseFilterEnum filter = Control.MouseFilterEnum.Ignore)
    {
        var p = new PanelContainer { MouseFilter = filter };
        p.AddThemeStyleboxOverride("panel", sb);
        return p;
    }

    static VBoxContainer VBox(int sep)
    {
        var v = new VBoxContainer { MouseFilter = Control.MouseFilterEnum.Ignore };
        v.AddThemeConstantOverride("separation", sep);
        return v;
    }

    static HBoxContainer HBox(int sep)
    {
        var h = new HBoxContainer { MouseFilter = Control.MouseFilterEnum.Ignore };
        h.AddThemeConstantOverride("separation", sep);
        return h;
    }

    static Control FullRect(Control c)
    {
        c.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        c.OffsetLeft = c.OffsetTop = c.OffsetRight = c.OffsetBottom = 0;
        return c;
    }

    /// <summary>Full-screen dim overlay used by journal / pause / loading (.screen).</summary>
    Control Screen(string name, Color bg)
    {
        var s = FullRect(new ColorRect { Name = name, Color = bg, MouseFilter = Control.MouseFilterEnum.Stop });
        s.Visible = false;
        _root.AddChild(s);
        return s;
    }

    static CenterContainer Center()
    {
        var c = new CenterContainer { MouseFilter = Control.MouseFilterEnum.Ignore };
        FullRect(c);
        return c;
    }

    Button MenuBtn(string text, Action onClick)
    {
        var b = new Button { Text = text, ThemeTypeVariation = "BigButton", CustomMinimumSize = new Vector2(0, 48), FocusMode = Control.FocusModeEnum.All };
        b.Pressed += () => onClick?.Invoke();
        return b;
    }

    static string Esc(string s) => (s ?? "").Replace("[", "[lb]");

    // =====================================================================================
    // HUD
    // =====================================================================================

    void BuildHud()
    {
        _hud = FullRect(new Control { Name = "Hud", MouseFilter = Control.MouseFilterEnum.Ignore });
        _hud.Visible = false;
        _root.AddChild(_hud);

        // era label (top left)
        var eraSb = Box(PanelBg, 0, 16, 9);
        eraSb.BorderColor = Accent;
        eraSb.BorderWidthLeft = 3;
        eraSb.CornerRadiusTopRight = eraSb.CornerRadiusBottomRight = 6;
        _eraPanel = PanelOf(eraSb);
        var ev = VBox(1);
        _eraName = Text("", 21, Ink, _serif);
        _eraYear = Text("", 12, InkDim, Spaced(_sans, 2));
        _eraYear.Uppercase = true;
        ev.AddChild(_eraName);
        ev.AddChild(_eraYear);
        _eraPanel.AddChild(ev);
        _hud.AddChild(_eraPanel);
        _district = Text("", 13, Ink, Spaced(_sans, 1));
        Outline(_district, new Color(0, 0, 0, 0.6f), 4);
        _hud.AddChild(_district);

        // minimap (top right): drop shadow, circular clip, map, ring + compass
        _minimap = new Control { Name = "Minimap", MouseFilter = Control.MouseFilterEnum.Ignore, Size = new Vector2(170, 170) };
        _minimap.Draw += () =>
        {
            var c = new Vector2(85, 87);
            for (int i = 6; i >= 1; i--) _minimap.DrawCircle(c, 85 + i * 1.6f, new Color(0, 0, 0, 0.07f));
        };
        var clipSb = Box(new Color(0.06f, 0.07f, 0.09f, 1), 85);
        var clip = PanelOf(clipSb);
        clip.ClipChildren = CanvasItem.ClipChildrenMode.AndDraw;
        clip.Size = new Vector2(170, 170);
        _minimap.AddChild(clip);
        _minimapMap = new Control { MouseFilter = Control.MouseFilterEnum.Ignore, Size = new Vector2(170, 170), TextureFilter = CanvasItem.TextureFilterEnum.Linear };
        _minimapMap.Draw += DrawMinimapContents;
        clip.AddChild(_minimapMap);
        var ring = new Control { MouseFilter = Control.MouseFilterEnum.Ignore, Size = new Vector2(170, 170) };
        _minimapRing = ring;
        ring.Draw += () =>
        {
            ring.DrawArc(new Vector2(85, 85), 84, 0, Mathf.Tau, 96, new Color(1, 1, 1, 0.38f), 2, true);
            ring.DrawArc(new Vector2(85, 85), 82.5f, 0, Mathf.Tau, 96, new Color(0, 0, 0, 0.35f), 1, true);
            // compass: N at the top of the map (moves round the rim when the map rotates)
            double ang = MinimapRotates ? _mmYaw : 0;
            var dir = new Vector2((float)Math.Sin(ang), -(float)Math.Cos(ang));
            var p = new Vector2(85, 85) + dir * 73;
            ring.DrawCircle(p, 8, new Color(0.05f, 0.06f, 0.08f, 0.75f));
            var sz = _sansBold.GetStringSize("N", HorizontalAlignment.Left, -1, 11);
            var tp = p + new Vector2(-sz.X / 2, 4);
            ring.DrawString(_sansBold, tp, "N", HorizontalAlignment.Left, -1, 11, Color.FromHtml("#ffffff"));
        };
        _minimap.AddChild(ring);
        _hud.AddChild(_minimap);

        // objective (bottom centre)
        _objective = PanelOf(Box(PanelBg, 7, 18, 9, new Color(1, 1, 1, 0.1f), 1));
        var ov = VBox(3);
        _objectiveTitle = Text("", 11, Accent, Spaced(_sansBold, 2), false, HorizontalAlignment.Center);
        _objectiveTitle.Uppercase = true;
        _objectiveText = Text("", 15, Ink, null, true, HorizontalAlignment.Center);
        ov.AddChild(_objectiveTitle);
        ov.AddChild(_objectiveText);
        _objective.AddChild(ov);
        _objective.Visible = false;
        _hud.AddChild(_objective);

        // interaction prompt
        var promptSb = Box(new Color(Accent, 0.94f), 5, 15, 7);
        promptSb.ShadowColor = new Color(0, 0, 0, 0.45f);
        promptSb.ShadowSize = 8;
        promptSb.ShadowOffset = new Vector2(0, 2);
        _prompt = PanelOf(promptSb);
        _promptLabel = Text("", 15, Color.FromHtml("#1a1408"), _sansBold);
        _prompt.AddChild(_promptLabel);
        _prompt.Visible = false;
        _hud.AddChild(_prompt);

        // toasts (top centre)
        _toasts = VBox(6);
        _toasts.Alignment = BoxContainer.AlignmentMode.Begin;
        _hud.AddChild(_toasts);
    }

    public void SetEra(Era era)
    {
        _eraName.Text = era.Name;
        _eraYear.Text = $"{era.Civ} · {era.YearLabel}";
    }

    public void SetDistrict(Era era, double x, double z)
    {
        string d = Macro.DistrictAt(x, z);
        _district.Text = era.DistrictNames != null && d != null && era.DistrictNames.TryGetValue(d, out var n) ? n : "";
    }

    public void SetObjective(string title, string text)
    {
        _objectiveTitle.Text = title ?? "";
        _objectiveText.Text = text ?? "";
        _objective.Visible = !string.IsNullOrEmpty(title) || !string.IsNullOrEmpty(text);
        // autowrap labels have no natural width: size the box to the text, up to 640 px
        float w = Math.Max(MeasureLabel(_objectiveText), MeasureLabel(_objectiveTitle));
        _objectiveText.CustomMinimumSize = new Vector2(Math.Min(w + 2, 640 - 36), 0);
    }

    public void SetPrompt(string textOrNull)
    {
        if (string.IsNullOrEmpty(textOrNull)) _prompt.Visible = false;
        else
        {
            _promptLabel.Text = textOrNull;
            _prompt.Visible = true;
        }
    }

    public void Notify(string text)
    {
        var sb = Box(PanelBg, 5, 18, 9, new Color(Accent, 0.5f), 1);
        sb.ShadowColor = new Color(0, 0, 0, 0.3f);
        sb.ShadowSize = 6;
        var toast = PanelOf(sb);
        toast.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;
        var l = Text(text, 15, Ink, null, true, HorizontalAlignment.Center);
        l.CustomMinimumSize = new Vector2(Math.Min(MeasureLabel(l) + 2, 720), 0);
        toast.AddChild(l);
        toast.Modulate = new Color(1, 1, 1, 0);
        _toasts.AddChild(toast);
        while (_toasts.GetChildCount() > 4)
        {
            var first = _toasts.GetChild(0);
            _toasts.RemoveChild(first);
            first.QueueFree();
        }
        // keyframes: fade in 0.4 s, hold, fade out from 4.25 s to 5 s
        var tw = toast.CreateTween();
        tw.TweenProperty(toast, "modulate:a", 1.0f, 0.4f).SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
        tw.TweenInterval(3.85f);
        tw.TweenProperty(toast, "modulate:a", 0.0f, 0.75f);
        tw.TweenCallback(Callable.From(() => { if (IsInstanceValid(toast)) toast.QueueFree(); }));
    }

    float MeasureLabel(Label l)
    {
        var font = l.GetThemeFont("font");
        int size = l.GetThemeFontSize("font_size");
        float w = 0;
        foreach (var line in (l.Uppercase ? l.Text.ToUpperInvariant() : l.Text).Split('\n'))
            w = Math.Max(w, font.GetStringSize(line, HorizontalAlignment.Left, -1, size).X);
        return w;
    }

    // ----- minimap -----

    public void DrawMinimap(Texture2D map, double px, double pz, double yaw, Marker marker, string eraId, IList<PortPin> ports)
    {
        _mmTex = map;
        _mmX = px;
        _mmZ = pz;
        _mmYaw = yaw;
        _mmMarker = marker;
        _mmEra = eraId;
        _mmPorts = ports;
        _minimapMap.QueueRedraw();
        if (MinimapRotates) _minimapRing.QueueRedraw();
    }

    void DrawMinimapContents()
    {
        var c = _minimapMap;
        const float W = 170;
        const double viewM = 130; // meters across
        double scale = W / viewM;
        double px = _mmX, pz = _mmZ;
        var center = new Vector2(W / 2, W / 2);
        if (MinimapRotates)
            c.DrawSetTransformMatrix(new Transform2D(0, center) * new Transform2D((float)_mmYaw, Vector2.Zero) * new Transform2D(0, -center));
        if (_mmTex != null)
        {
            var (mx, my) = MapImage.WorldToMap(px, pz);
            double srcW = viewM / (Macro.WORLD_HALF * 2) * MapImage.MAP_PX;
            // when rotating, draw a larger window so the corners stay filled
            double grow = MinimapRotates ? 1.42 : 1.0;
            double sw = srcW * grow;
            double sx0 = mx - sw / 2, sy0 = my - sw / 2, sx1 = sx0 + sw, sy1 = sy0 + sw;
            double dScale = W * grow / sw;
            double dOff = -(W * grow - W) / 2;
            // clip the source window to the image like canvas drawImage does
            double cx0 = Math.Max(0, sx0), cy0 = Math.Max(0, sy0), cx1 = Math.Min(MapImage.MAP_PX, sx1), cy1 = Math.Min(MapImage.MAP_PX, sy1);
            if (cx1 > cx0 && cy1 > cy0)
            {
                var src = new Rect2((float)cx0, (float)cy0, (float)(cx1 - cx0), (float)(cy1 - cy0));
                var dst = new Rect2((float)(dOff + (cx0 - sx0) * dScale), (float)(dOff + (cy0 - sy0) * dScale), (float)((cx1 - cx0) * dScale), (float)((cy1 - cy0) * dScale));
                c.DrawTextureRectRegion(_mmTex, dst, src);
            }
        }
        Vector2 ToScreen(double x, double z) => new((float)(W / 2 + (x - px) * scale), (float)(W / 2 + (z - pz) * scale));
        if (_mmPorts != null)
            foreach (var p in _mmPorts)
            {
                var s = ToScreen(p.X, p.Z);
                if (s.X < -10 || s.X > W + 10 || s.Y < -10 || s.Y > W + 10) continue;
                c.DrawArc(s, 5, 0, Mathf.Tau, 24, p.Found ? Accent2 : new Color(Accent2, 0.35f), 2, true);
            }
        if (_mmMarker != null && _mmMarker.Era == _mmEra)
        {
            var s = ToScreen(_mmMarker.X, _mmMarker.Z);
            float dx = s.X - W / 2, dz = s.Y - W / 2;
            float d = Mathf.Sqrt(dx * dx + dz * dz);
            float r = W / 2 - 10;
            float cx = d > r ? W / 2 + dx / d * r : s.X;
            float cz = d > r ? W / 2 + dz / d * r : s.Y;
            Diamond(c, new Vector2(cx, cz), 6, 7, Accent, new Color(0, 0, 0, 0.5f));
        }
        // player
        c.DrawSetTransform(center, MinimapRotates ? 0 : -(float)_mmYaw, Vector2.One);
        var arrow = new[] { new Vector2(0, -8), new Vector2(6, 6), new Vector2(0, 3), new Vector2(-6, 6) };
        c.DrawColoredPolygon(arrow, Colors.White);
        c.DrawPolyline(new[] { arrow[0], arrow[1], arrow[2], arrow[3], arrow[0] }, new Color(0, 0, 0, 0.55f), 1, true);
        c.DrawSetTransformMatrix(Transform2D.Identity);
    }

    static void Diamond(CanvasItem c, Vector2 p, float hw, float hh, Color fill, Color? outline = null)
    {
        var pts = new[] { p + new Vector2(0, -hh), p + new Vector2(hw, 0), p + new Vector2(0, hh), p + new Vector2(-hw, 0) };
        c.DrawColoredPolygon(pts, fill);
        c.DrawPolyline(new[] { pts[0], pts[1], pts[2], pts[3], pts[0] }, outline ?? fill, 1, true);
    }

    // =====================================================================================
    // Dialogue
    // =====================================================================================

    void BuildDialogue()
    {
        var sb = Box(new Color(12 / 255f, 14 / 255f, 20 / 255f, 0.88f), 10, 22, 16, new Color(1, 1, 1, 0.18f), 1);
        sb.ShadowColor = new Color(0, 0, 0, 0.35f);
        sb.ShadowSize = 14;
        sb.ShadowOffset = new Vector2(0, 4);
        _dialogue = PanelOf(sb, Control.MouseFilterEnum.Stop);
        _dialogue.Name = "Dialogue";
        _dialogue.MouseDefaultCursorShape = Control.CursorShape.PointingHand;
        var v = VBox(8);
        _dialogueSpeaker = Text("", 18, Accent, _serif);
        _dialogueText = Text("", 18, Ink, null, true);
        _dialogueText.AddThemeConstantOverride("line_spacing", 5);
        _dialogueText.CustomMinimumSize = new Vector2(0, 50);
        _dialogueText.VisibleCharactersBehavior = TextServer.VisibleCharactersBehavior.CharsAfterShaping;
        _dialogueHint = Text("E  to continue", 11, InkDim, Spaced(_sans, 1), false, HorizontalAlignment.Right);
        v.AddChild(_dialogueSpeaker);
        v.AddChild(_dialogueText);
        v.AddChild(_dialogueHint);
        _dialogue.AddChild(v);
        _dialogue.Visible = false;
        _dialogue.GuiInput += e =>
        {
            if (e is InputEventMouseButton mb && mb.Pressed && mb.ButtonIndex == MouseButton.Left) AdvanceDialogue();
        };
        _root.AddChild(_dialogue);
    }

    public bool DialogueOpen => _dialogue.Visible;

    public Task ShowDialogue(string speaker, string[] lines)
    {
        _dialogueLines = lines ?? Array.Empty<string>();
        _dialogueIndex = 0;
        _dialogueSpeaker.Text = speaker ?? "";
        StartLine(_dialogueLines.Length > 0 ? _dialogueLines[0] : "");
        _dialogue.Visible = true;
        _dialogueTcs?.TrySetResult();
        _dialogueTcs = new TaskCompletionSource();
        return _dialogueTcs.Task;
    }

    /// <summary>E / click: finishes the typewriter on the current line, else moves to the next line
    /// and closes (resolving the ShowDialogue task) after the last one.</summary>
    public void AdvanceDialogue()
    {
        if (!DialogueOpen) return;
        if (_typing)
        {
            FinishTyping();
            return;
        }
        _dialogueIndex++;
        if (_dialogueIndex >= _dialogueLines.Length)
        {
            _dialogue.Visible = false;
            var r = _dialogueTcs;
            _dialogueTcs = null;
            r?.TrySetResult();
        }
        else StartLine(_dialogueLines[_dialogueIndex]);
    }

    void StartLine(string text)
    {
        _dialogueText.Text = text ?? "";
        _typeTotal = (text ?? "").Length;
        _typePos = 0;
        _typing = _typeTotal > 0;
        _dialogueText.VisibleCharacters = _typing ? 0 : -1;
        _dialogueHint.Modulate = new Color(1, 1, 1, 0.35f);
        bool last = _dialogueIndex >= _dialogueLines.Length - 1;
        _dialogueHint.Text = last ? "E  to close" : "E  to continue   ▸";
    }

    void FinishTyping()
    {
        _typing = false;
        _dialogueText.VisibleCharacters = -1;
        _dialogueHint.Modulate = Colors.White;
    }

    // =====================================================================================
    // Journal
    // =====================================================================================

    void BuildJournal()
    {
        _journal = Screen("Journal", ScreenBg);
        var center = Center();
        _journal.AddChild(center);
        var innerSb = Box(InnerBg, 12, 0, 0, new Color(1, 1, 1, 0.15f), 1);
        innerSb.ShadowColor = new Color(0, 0, 0, 0.5f);
        innerSb.ShadowSize = 24;
        var inner = PanelOf(innerSb, Control.MouseFilterEnum.Stop);
        inner.CustomMinimumSize = new Vector2(980, 740);
        center.AddChild(inner);
        var col = VBox(0);
        inner.AddChild(col);

        // tab bar
        var barSb = Box(new Color(0, 0, 0, 0), 0, 10, 10);
        barSb.BorderColor = Hairline;
        barSb.BorderWidthBottom = 1;
        var bar = PanelOf(barSb);
        var tabs = HBox(4);
        bar.AddChild(tabs);
        col.AddChild(bar);
        var group = new ButtonGroup();
        foreach (var (id, label) in new[] { ("map", "Map"), ("quests", "Objectives"), ("ports", "Chronoports"), ("insights", "Insights") })
        {
            var b = new Button { Text = label, ThemeTypeVariation = "TabButton", ToggleMode = true, ButtonGroup = group, FocusMode = Control.FocusModeEnum.None };
            string tabId = id;
            b.Pressed += () => ShowTab(tabId);
            tabs.AddChild(b);
            _tabButtons[id] = b;
        }
        tabs.AddChild(new Control { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, MouseFilter = Control.MouseFilterEnum.Ignore });
        var close = new Button { Text = "Close", FocusMode = Control.FocusModeEnum.None };
        close.Pressed += () => OnJournalClose?.Invoke();
        tabs.AddChild(close);

        // pages
        var pages = new MarginContainer { SizeFlagsVertical = Control.SizeFlags.ExpandFill, MouseFilter = Control.MouseFilterEnum.Ignore };
        foreach (var side in new[] { "left", "right", "top", "bottom" }) pages.AddThemeConstantOverride("margin_" + side, 18);
        col.AddChild(pages);

        // map page
        var mapPage = HBox(22);
        mapPage.Alignment = BoxContainer.AlignmentMode.Center;
        var frame = PanelOf(Box(new Color(0.05f, 0.06f, 0.08f, 1), 8));
        frame.ClipChildren = CanvasItem.ClipChildrenMode.AndDraw;
        frame.CustomMinimumSize = new Vector2(620, 620);
        frame.SizeFlagsVertical = Control.SizeFlags.ShrinkBegin;
        _bigmap = new Control { MouseFilter = Control.MouseFilterEnum.Ignore, CustomMinimumSize = new Vector2(620, 620), TextureFilter = CanvasItem.TextureFilterEnum.Linear };
        _bigmap.Draw += DrawBigMap;
        frame.AddChild(_bigmap);
        var frameWrap = new Control { CustomMinimumSize = new Vector2(620, 620), MouseFilter = Control.MouseFilterEnum.Ignore, SizeFlagsVertical = Control.SizeFlags.ShrinkBegin };
        frameWrap.AddChild(frame);
        var border = PanelOf(Box(new Color(0, 0, 0, 0), 8, 0, 0, new Color(1, 1, 1, 0.2f), 1));
        border.Size = new Vector2(620, 620);
        frameWrap.AddChild(border);
        frame.Size = new Vector2(620, 620);
        mapPage.AddChild(frameWrap);
        _legend = VBox(6);
        _legend.CustomMinimumSize = new Vector2(250, 0);
        _legend.SizeFlagsVertical = Control.SizeFlags.ShrinkBegin;
        mapPage.AddChild(_legend);
        AddPage(pages, "map", mapPage);

        _questsList = AddScrollPage(pages, "quests");
        _portsList = AddScrollPage(pages, "ports");
        _insightsList = AddScrollPage(pages, "insights");
    }

    void AddPage(Control parent, string id, Control page)
    {
        page.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        parent.AddChild(page);
        _tabPages[id] = page;
    }

    VBoxContainer AddScrollPage(Control parent, string id)
    {
        var scroll = new ScrollContainer { HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled, MouseFilter = Control.MouseFilterEnum.Pass };
        var list = VBox(10);
        list.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        var pad = new MarginContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, MouseFilter = Control.MouseFilterEnum.Ignore };
        pad.AddThemeConstantOverride("margin_right", 12);
        pad.AddThemeConstantOverride("margin_left", 4);
        pad.AddChild(list);
        scroll.AddChild(pad);
        AddPage(parent, id, scroll);
        return list;
    }

    public bool JournalOpen => _journal.Visible;

    public void OpenJournal(JournalData d)
    {
        _journal.Visible = true;
        RenderJournal(d);
    }

    public void CloseJournal()
    {
        _journal.Visible = false;
        _journalData = null;
    }

    /// <summary>Switch journal tab by offset (for gamepad shoulder buttons). Optional.</summary>
    public void JournalNextTab(int dir)
    {
        string[] order = { "map", "quests", "ports", "insights" };
        int i = Array.IndexOf(order, _journalTab);
        ShowTab(order[((i + dir) % order.Length + order.Length) % order.Length]);
    }

    void ShowTab(string tab)
    {
        _journalTab = tab;
        foreach (var kv in _tabButtons) kv.Value.SetPressedNoSignal(kv.Key == tab);
        foreach (var kv in _tabPages) kv.Value.Visible = kv.Key == tab;
    }

    PanelContainer Card(Color accent, Color bg, float alpha = 1)
    {
        var sb = Box(bg, 5, 16, 12);
        sb.BorderColor = accent;
        sb.BorderWidthLeft = 3;
        var p = PanelOf(sb);
        p.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        p.Modulate = new Color(1, 1, 1, alpha);
        return p;
    }

    RichTextLabel Rich(string bbcode, int size = 14)
    {
        var r = new RichTextLabel { BbcodeEnabled = true, FitContent = true, ScrollActive = false, AutowrapMode = TextServer.AutowrapMode.WordSmart, MouseFilter = Control.MouseFilterEnum.Ignore, Text = bbcode };
        r.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        foreach (var k in new[] { "normal_font_size", "bold_font_size", "italics_font_size" }) r.AddThemeFontSizeOverride(k, size);
        return r;
    }

    static void Clear(Control c)
    {
        foreach (var ch in c.GetChildren())
        {
            c.RemoveChild(ch);
            ch.QueueFree();
        }
    }

    static string Hex(Color c) => "#" + c.ToHtml(false);

    void RenderJournal(JournalData d)
    {
        _journalData = d;
        ShowTab(_journalTab);
        _bigmap.QueueRedraw();

        // legend
        Clear(_legend);
        _legend.AddChild(Text(d.Era.Name, 22, Ink, _serif, true));
        var yl = Text($"{d.Era.Civ} · {d.Era.YearLabel}", 12, Accent, Spaced(_sans, 2));
        yl.Uppercase = true;
        _legend.AddChild(yl);
        _legend.AddChild(new Control { CustomMinimumSize = new Vector2(0, 4) });
        var lore = Text(d.Era.Lore ?? "", 14, InkDim, null, true);
        lore.AddThemeConstantOverride("line_spacing", 4);
        _legend.AddChild(lore);
        _legend.AddChild(new Control { CustomMinimumSize = new Vector2(0, 10) });
        _legend.AddChild(LegendRow(LegendIcon.Player, "you"));
        _legend.AddChild(LegendRow(LegendIcon.Objective, "objective"));
        _legend.AddChild(LegendRow(LegendIcon.PortFound, "chronoport found"));
        _legend.AddChild(LegendRow(LegendIcon.PortRumour, "rumoured"));

        // quests
        Clear(_questsList);
        var active = d.Quests.Active;
        if (active.Count == 0) _questsList.AddChild(Text("No active objectives. Explore the city, talk to people, and look for doors.", 14, InkDim, null, true));
        foreach (var q in active)
        {
            var step = d.Quests.CurrentStep(q);
            var card = Card(Accent, new Color(1, 1, 1, 0.045f));
            var v = VBox(4);
            v.AddChild(Text(q.Title, 19, Ink, _serif, true));
            v.AddChild(Text(q.Summary ?? "", 14, InkDim, null, true));
            string stepEra = QuestManager.StepEra(step);
            string where = stepEra != d.Era.Id ? $"  [i][color={Hex(InkDim)}](in {Esc(GameData.GetEra(stepEra).YearLabel)})[/color][/i]" : "";
            v.AddChild(Rich($"[color={Hex(Accent)}]◆[/color]  {Esc(step.Objective)}{where}", 14));
            card.AddChild(v);
            _questsList.AddChild(card);
        }
        foreach (var q in d.Quests.Completed)
        {
            var card = Card(Color.FromHtml("#6a8a6a"), new Color(1, 1, 1, 0.03f), 0.7f);
            var v = VBox(2);
            v.AddChild(Text(q.Title, 19, Ink, _serif, true));
            v.AddChild(Text("Complete", 13, InkDim));
            card.AddChild(v);
            _questsList.AddChild(card);
        }

        // ports
        Clear(_portsList);
        _portsList.AddChild(Text($"Chronoports are rings of stone that stand in the same place in every era. Each opens on one year, and from that year leads home to 1938. {d.Discovered.Count} of {GameData.ChronoportEras.Length} found.", 14, InkDim, null, true));
        foreach (var e in GameData.Eras)
        {
            if (e.Chronoport == null) continue;
            bool found = d.Discovered.Contains(e.Id);
            bool hinted = d.Hints.Contains(e.Id);
            var card = Card(found ? Accent2 : hinted ? Accent : new Color(0.27f, 0.27f, 0.27f), new Color(1, 1, 1, 0.04f));
            var v = VBox(3);
            string where = found ? $"Found: {e.Chronoport.PlaceName}." : hinted ? $"Rumour: {e.Chronoport.Hint}" : "Location unknown. Explore, or ask around.";
            v.AddChild(Text(found || hinted ? $"{e.Civ} · {e.YearLabel}" : "??? · " + e.YearLabel, 17, found || hinted ? Ink : InkDim, _serif));
            v.AddChild(Text(where, 14, InkDim, null, true));
            card.AddChild(v);
            _portsList.AddChild(card);
        }

        // insights
        Clear(_insightsList);
        string home = GameData.HomeEraId ?? "industrial";
        _insightsList.AddChild(Text($"Every civilization you visit fell for a reason. {d.Insights.Count} of {GameData.Eras.Length - 1} lessons recorded.", 14, InkDim, null, true));
        foreach (var e in GameData.Eras)
        {
            if (e.Id == home) continue;
            bool has = d.Insights.Contains(e.Id);
            var card = has ? Card(Accent2, new Color(Accent2, 0.07f)) : Card(new Color(0.27f, 0.27f, 0.27f), new Color(1, 1, 1, 0.03f), 0.5f);
            var v = VBox(5);
            if (has)
            {
                var h = HBox(10);
                h.AddChild(Text(e.Insight?.Title ?? "", 19, Ink, _serif));
                var sub = Text($"({e.Civ}, {e.YearLabel})", 13, InkDim);
                sub.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
                h.AddChild(sub);
                v.AddChild(h);
                var body = Text(e.Insight?.Text ?? "", 15, Ink, null, true);
                body.AddThemeConstantOverride("line_spacing", 4);
                v.AddChild(body);
            }
            else
            {
                v.AddChild(Text($"{e.Civ}, {e.YearLabel}", 17, Ink, _serif));
                v.AddChild(Text("Not yet understood.", 14, InkDim));
            }
            card.AddChild(v);
            _insightsList.AddChild(card);
        }
    }

    enum LegendIcon { Player, Objective, PortFound, PortRumour }

    Control LegendRow(LegendIcon icon, string label)
    {
        var h = HBox(10);
        var ic = new Control { CustomMinimumSize = new Vector2(18, 18), MouseFilter = Control.MouseFilterEnum.Ignore };
        ic.Draw += () =>
        {
            var c = new Vector2(9, 9);
            switch (icon)
            {
                case LegendIcon.Player:
                    ic.DrawColoredPolygon(new[] { c + new Vector2(0, -7), c + new Vector2(6, 7), c + new Vector2(0, 3), c + new Vector2(-6, 7) }, Colors.White);
                    break;
                case LegendIcon.Objective:
                    Diamond(ic, c, 6, 8, Accent);
                    break;
                case LegendIcon.PortFound:
                    ic.DrawArc(c, 6.5f, 0, Mathf.Tau, 24, Accent2, 2, true);
                    break;
                case LegendIcon.PortRumour:
                    DashedCircle(ic, c, 7, Accent, 2, 3);
                    break;
            }
        };
        h.AddChild(ic);
        h.AddChild(Text(label, 14, InkDim));
        return h;
    }

    static void DashedCircle(CanvasItem c, Vector2 center, float r, Color col, float width, float dash)
    {
        float circ = Mathf.Tau * r;
        int n = Math.Max(4, (int)Math.Round(circ / (dash * 2)));
        float step = Mathf.Tau / n;
        for (int i = 0; i < n; i++) c.DrawArc(center, r, i * step, i * step + step * 0.5f, 4, col, width, true);
    }

    void DrawBigMap()
    {
        var d = _journalData;
        if (d == null) return;
        var c = _bigmap;
        float S = c.Size.X;
        double k = S / MapImage.MAP_PX;
        if (d.MapImage != null) c.DrawTextureRect(d.MapImage, new Rect2(0, 0, S, S), false);
        Vector2 ToS(double x, double z)
        {
            var (mx, my) = MapImage.WorldToMap(x, z);
            return new Vector2((float)(mx * k), (float)(my * k));
        }
        Font font = _sansBold;
        const int fs = 12;
        void CenterText(Vector2 p, string text, Color col)
        {
            float w = font.GetStringSize(text, HorizontalAlignment.Left, -1, fs).X;
            var at = p - new Vector2(w / 2, 0);
            c.DrawStringOutline(font, at, text, HorizontalAlignment.Left, -1, fs, 4, new Color(0, 0, 0, 0.55f));
            c.DrawString(font, at, text, HorizontalAlignment.Left, -1, fs, col);
        }
        foreach (var id in Macro.SITE_ORDER)
        {
            var s = Macro.SITES[id];
            var sp = ToS(s.X, s.Z);
            string dist = Macro.DistrictAt(s.X, s.Z);
            string name = d.Era.DistrictNames != null && dist != null && d.Era.DistrictNames.TryGetValue(dist, out var n) ? n : s.Label;
            CenterText(sp, name, Colors.White);
        }
        foreach (var e in GameData.ChronoportEras)
        {
            var p = e.Chronoport;
            bool found = d.Discovered.Contains(e.Id);
            bool hinted = d.Hints.Contains(e.Id);
            if (!found && !hinted) continue;
            var sp = ToS(p.X, p.Z);
            if (found)
            {
                c.DrawArc(sp, 7, 0, Mathf.Tau, 28, Accent2, 2, true);
                CenterText(sp + new Vector2(0, -10), e.YearLabel, Accent2);
            }
            else DashedCircle(c, sp, 14, Accent, 2, 3);
        }
        if (d.Marker != null && d.Marker.Era == d.Era.Id)
        {
            var sp = ToS(d.Marker.X, d.Marker.Z);
            Diamond(c, sp, 8, 10, Accent, new Color(0, 0, 0, 0.5f));
            CenterText(sp + new Vector2(0, -14), d.Marker.Label ?? "", Accent);
        }
        var pp = ToS(d.PlayerX, d.PlayerZ);
        c.DrawSetTransform(pp, -(float)d.PlayerYaw, Vector2.One);
        var arrow = new[] { new Vector2(0, -9), new Vector2(7, 7), new Vector2(0, 3), new Vector2(-7, 7) };
        c.DrawColoredPolygon(arrow, Colors.White);
        c.DrawPolyline(new[] { arrow[0], arrow[1], arrow[2], arrow[3], arrow[0] }, Colors.Black, 1, true);
        c.DrawSetTransformMatrix(Transform2D.Identity);
    }

    // =====================================================================================
    // Pause
    // =====================================================================================

    PanelContainer MenuPanel(float width, float alpha = 0.97f)
    {
        var sb = Box(new Color(InnerBg, alpha), 12, 34, 28, new Color(1, 1, 1, 0.15f), 1);
        sb.ShadowColor = new Color(0, 0, 0, 0.45f);
        sb.ShadowSize = 24;
        var p = PanelOf(sb, Control.MouseFilterEnum.Stop);
        p.CustomMinimumSize = new Vector2(width, 0);
        return p;
    }

    void BuildPause()
    {
        _pause = Screen("Pause", new Color(ScreenBg, 0.75f));
        var center = Center();
        _pause.AddChild(center);
        var menu = MenuPanel(480);
        center.AddChild(menu);
        var v = VBox(10);
        menu.AddChild(v);
        var h1 = Text("Paused", 34, Ink, Spaced(_serif, 2), false, HorizontalAlignment.Center);
        v.AddChild(h1);
        v.AddChild(new Control { CustomMinimumSize = new Vector2(0, 6) });
        _pauseResume = MenuBtn("Resume", () => OnPauseResume?.Invoke());
        v.AddChild(_pauseResume);
        v.AddChild(MenuBtn("Save game", () => OnPauseSave?.Invoke()));
        _pauseQuality = MenuBtn("Quality: medium", () => OnPauseQuality?.Invoke());
        v.AddChild(_pauseQuality);
        v.AddChild(MenuBtn("Controls", () => _controlsHelp.Visible = !_controlsHelp.Visible));
        v.AddChild(MenuBtn("Save and quit to title", () => OnPauseQuit?.Invoke()));

        // controls help
        var helpSb = Box(new Color(1, 1, 1, 0.035f), 8, 14, 12);
        var help = PanelOf(helpSb);
        var grid = new GridContainer { Columns = 2, MouseFilter = Control.MouseFilterEnum.Ignore };
        grid.AddThemeConstantOverride("h_separation", 14);
        grid.AddThemeConstantOverride("v_separation", 7);
        (string keys, string action)[] rows =
        {
            ("WASD / Left stick", "Move"),
            ("Mouse / Right stick", "Look"),
            ("Shift / L3", "Run"),
            ("Space / A", "Jump"),
            ("E / X", "Talk, use, continue"),
            ("M or Tab / Back", "Journal and map"),
            ("Esc / Start", "Pause"),
            ("`", "Dev panel"),
        };
        foreach (var (keys, action) in rows)
        {
            var kh = HBox(4);
            kh.SizeFlagsHorizontal = Control.SizeFlags.ShrinkEnd;
            var parts = keys.Split(" / ");
            for (int i = 0; i < parts.Length; i++)
            {
                if (i > 0) kh.AddChild(Sep("/"));
                var alts = parts[i].Split(" or ");
                for (int j = 0; j < alts.Length; j++)
                {
                    if (j > 0) kh.AddChild(Sep("or"));
                    kh.AddChild(KeyCap(alts[j]));
                }
            }
            grid.AddChild(kh);
            var al = Text(action, 14, InkDim);
            al.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
            grid.AddChild(al);
        }
        help.AddChild(grid);
        _controlsHelp = help;
        _controlsHelp.Visible = false;
        v.AddChild(_controlsHelp);
    }

    Label Sep(string s)
    {
        var l = Text(s, 12, new Color(InkDim, 0.6f));
        l.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        return l;
    }

    Control KeyCap(string key)
    {
        var sb = Box(new Color(1, 1, 1, 0.08f), 4, 7, 2, new Color(1, 1, 1, 0.22f), 1);
        sb.BorderWidthBottom = 2;
        var p = PanelOf(sb);
        p.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
        p.AddChild(Text(key, 12, Ink, _sansBold, false, HorizontalAlignment.Center));
        return p;
    }

    public bool PauseOpen => _pause.Visible;

    public void OpenPause(string quality)
    {
        SetQualityLabel(quality);
        _pause.Visible = true;
        _pauseResume.CallDeferred(Control.MethodName.GrabFocus);
    }

    public void ClosePause()
    {
        _pause.Visible = false;
        _controlsHelp.Visible = false;
    }

    public void SetQualityLabel(string q) => _pauseQuality.Text = $"Quality: {q}";

    // =====================================================================================
    // Title
    // =====================================================================================

    void BuildTitle()
    {
        // semi-transparent so the orbiting city shows behind: a vignette darkening toward the edges
        _title = FullRect(new Control { Name = "Title", MouseFilter = Control.MouseFilterEnum.Stop });
        _root.AddChild(_title);
        var grad = new Gradient();
        grad.SetColor(0, new Color(6 / 255f, 8 / 255f, 12 / 255f, 0.18f));
        grad.SetColor(1, new Color(6 / 255f, 8 / 255f, 12 / 255f, 0.78f));
        var vignette = FullRect(new TextureRect
        {
            Texture = new GradientTexture2D { Gradient = grad, Fill = GradientTexture2D.FillEnum.Radial, FillFrom = new Vector2(0.5f, 0.45f), FillTo = new Vector2(1.15f, 0.45f), Width = 256, Height = 256 },
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.Scale,
            MouseFilter = Control.MouseFilterEnum.Ignore,
        });
        _title.AddChild(vignette);
        var center = Center();
        _title.AddChild(center);

        var menu = MenuPanel(500, 0.72f);
        center.AddChild(menu);
        var v = VBox(12);
        menu.AddChild(v);

        // logo with a soft glow behind it
        var logoWrap = new Control { CustomMinimumSize = new Vector2(0, 70), MouseFilter = Control.MouseFilterEnum.Ignore };
        var glow = Glow(Accent, 0.22f);
        glow.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        glow.OffsetLeft = -30; glow.OffsetRight = 30; glow.OffsetTop = -20; glow.OffsetBottom = 20;
        logoWrap.AddChild(glow);
        var logo = Text("CHRONOPOLIS", 50, Accent, Spaced(_serif, 9), false, HorizontalAlignment.Center);
        logo.VerticalAlignment = VerticalAlignment.Center;
        FullRect(logo);
        logo.AddThemeColorOverride("font_shadow_color", new Color(Accent, 0.25f));
        logo.AddThemeConstantOverride("shadow_outline_size", 6);
        logo.AddThemeConstantOverride("shadow_offset_x", 0);
        logo.AddThemeConstantOverride("shadow_offset_y", 0);
        logoWrap.AddChild(logo);
        v.AddChild(logoWrap);
        v.AddChild(Text("One city. Five thousand years. Eighteen doors.", 17, InkDim, _serifItalic, false, HorizontalAlignment.Center));
        v.AddChild(new Control { CustomMinimumSize = new Vector2(0, 8) });

        var buttons = VBox(10);
        _titleContinue = MenuBtn("Continue", () => { if (_titleHasSave) _titleOnContinue?.Invoke(); });
        _titleNew = MenuBtn("New game", () =>
        {
            if (_titleHasSave)
            {
                _titleButtons.Visible = false;
                _titleConfirm.Visible = true;
                _titleConfirm.GetNode<Button>("Row/Cancel").CallDeferred(Control.MethodName.GrabFocus);
                return;
            }
            _titleOnNew?.Invoke();
        });
        buttons.AddChild(_titleContinue);
        buttons.AddChild(_titleNew);
        _titleButtons = buttons;
        v.AddChild(buttons);

        // in-place replacement for confirm('Start a new game? ...')
        var confirm = VBox(10);
        confirm.Name = "Confirm";
        confirm.AddChild(Text("Start a new game? Your saved city will be overwritten.", 15, Ink, null, true, HorizontalAlignment.Center));
        var row = HBox(10);
        row.Name = "Row";
        var cancel = MenuBtn("Cancel", () => { _titleConfirm.Visible = false; _titleButtons.Visible = true; _titleNew.GrabFocus(); });
        cancel.Name = "Cancel";
        cancel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        var ok = MenuBtn("Start over", () => { _titleConfirm.Visible = false; _titleButtons.Visible = true; _titleOnNew?.Invoke(); });
        ok.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        row.AddChild(cancel);
        row.AddChild(ok);
        confirm.AddChild(row);
        confirm.Visible = false;
        _titleConfirm = confirm;
        v.AddChild(confirm);

        v.AddChild(new Control { CustomMinimumSize = new Vector2(0, 2) });
        var hint = Text("WASD or left stick to move · mouse or right stick to look\nE talk and use · M journal · Esc pause", 13, InkDim, null, false, HorizontalAlignment.Center);
        hint.AddThemeConstantOverride("line_spacing", 4);
        v.AddChild(hint);
    }

    /// <summary>Soft radial glow (a stand-in for CSS text-shadow blur).</summary>
    static TextureRect Glow(Color col, float alpha)
    {
        var g = new Gradient();
        g.SetColor(0, new Color(col, alpha));
        g.SetColor(1, new Color(col, 0));
        return new TextureRect
        {
            Texture = new GradientTexture2D { Gradient = g, Fill = GradientTexture2D.FillEnum.Radial, FillFrom = new Vector2(0.5f, 0.5f), FillTo = new Vector2(1f, 0.5f), Width = 128, Height = 64 },
            ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize,
            StretchMode = TextureRect.StretchModeEnum.Scale,
            MouseFilter = Control.MouseFilterEnum.Ignore,
        };
    }

    public void ShowTitle(bool hasSave, Action onNew, Action onContinue)
    {
        _titleHasSave = hasSave;
        _titleOnNew = onNew;
        _titleOnContinue = onContinue;
        _titleContinue.Disabled = !hasSave;
        _titleContinue.FocusMode = hasSave ? Control.FocusModeEnum.All : Control.FocusModeEnum.None;
        _titleButtons.Visible = true;
        _titleConfirm.Visible = false;
        _title.Visible = true;
        _hud.Visible = false;
        (hasSave ? _titleContinue : _titleNew).CallDeferred(Control.MethodName.GrabFocus);
    }

    public void HideTitle()
    {
        _title.Visible = false;
        _hud.Visible = true;
    }

    // =====================================================================================
    // Loading / transition
    // =====================================================================================

    void BuildLoading()
    {
        _loading = Screen("Loading", ScreenBg);
        var center = Center();
        _loading.AddChild(center);
        var v = VBox(16);
        center.AddChild(v);
        _spinner = new Control { CustomMinimumSize = new Vector2(44, 44), SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter, MouseFilter = Control.MouseFilterEnum.Ignore };
        _spinner.Draw += () =>
        {
            var c = new Vector2(22, 22);
            _spinner.DrawArc(c, 19, 0, Mathf.Tau, 48, new Color(1, 1, 1, 0.2f), 3, true);
            float a = (float)(Time.GetTicksMsec() / 1000.0 * Mathf.Tau / 0.9);
            _spinner.DrawArc(c, 19, a, a + Mathf.Pi * 0.5f, 16, Accent, 3, true);
        };
        v.AddChild(_spinner);
        _loadingText = Text("Building the city...", 15, Ink, null, false, HorizontalAlignment.Center);
        v.AddChild(_loadingText);
    }

    public void ShowLoading(string text)
    {
        _loadingText.Text = text;
        _loading.Visible = true;
    }

    public void HideLoading() => _loading.Visible = false;

    void BuildTransition()
    {
        _transition = FullRect(new ColorRect { Name = "Transition", Color = Colors.Black, MouseFilter = Control.MouseFilterEnum.Stop });
        _transition.Visible = false;
        _root.AddChild(_transition);
        var grad = new Gradient();
        grad.Offsets = new float[] { 0, 0.55f, 1 };
        grad.Colors = new[] { Colors.Black, Colors.Black, Colors.Black };
        _transGradient = new GradientTexture2D { Gradient = grad, Fill = GradientTexture2D.FillEnum.Radial, FillFrom = new Vector2(0.5f, 0.5f), FillTo = new Vector2(1.1f, 0.5f), Width = 256, Height = 256 };
        _transitionBg = FullRect(new TextureRect { Texture = _transGradient, ExpandMode = TextureRect.ExpandModeEnum.IgnoreSize, StretchMode = TextureRect.StretchModeEnum.Scale, MouseFilter = Control.MouseFilterEnum.Ignore }) as TextureRect;
        _transition.AddChild(_transitionBg);
        _transitionFlash = FullRect(new ColorRect { Color = new Color(1, 1, 1, 0), MouseFilter = Control.MouseFilterEnum.Ignore }) as ColorRect;
        _transition.AddChild(_transitionFlash);

        var center = Center();
        _transition.AddChild(center);
        var v = VBox(0);
        v.CustomMinimumSize = new Vector2(620, 0);
        center.AddChild(v);
        _transitionCard = v;

        var yearWrap = new Control { CustomMinimumSize = new Vector2(0, 92), MouseFilter = Control.MouseFilterEnum.Ignore };
        var glow = Glow(Accent2, 0.2f);
        glow.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        glow.OffsetLeft = 60; glow.OffsetRight = -60; glow.OffsetTop = -24; glow.OffsetBottom = 24;
        yearWrap.AddChild(glow);
        _transYear = Text("", 68, Accent2, Spaced(_serif, 6), false, HorizontalAlignment.Center);
        _transYear.VerticalAlignment = VerticalAlignment.Center;
        _transYear.AddThemeColorOverride("font_shadow_color", new Color(Accent2, 0.22f));
        _transYear.AddThemeConstantOverride("shadow_outline_size", 8);
        _transYear.AddThemeConstantOverride("shadow_offset_x", 0);
        _transYear.AddThemeConstantOverride("shadow_offset_y", 0);
        FullRect(_transYear);
        yearWrap.AddChild(_transYear);
        v.AddChild(yearWrap);

        var rule = new Control { CustomMinimumSize = new Vector2(0, 22), MouseFilter = Control.MouseFilterEnum.Ignore };
        rule.Draw += () =>
        {
            float cx = rule.Size.X / 2, y = 11;
            for (int i = 0; i < 60; i++)
            {
                float a = 1 - i / 60f;
                rule.DrawLine(new Vector2(cx + i * 1.5f, y), new Vector2(cx + (i + 1) * 1.5f, y), new Color(Accent2, 0.55f * a), 1);
                rule.DrawLine(new Vector2(cx - i * 1.5f, y), new Vector2(cx - (i + 1) * 1.5f, y), new Color(Accent2, 0.55f * a), 1);
            }
            Diamond(rule, new Vector2(cx, y), 3, 4, Accent2);
        };
        v.AddChild(rule);
        _transName = Text("", 28, Ink, _serif, false, HorizontalAlignment.Center);
        v.AddChild(_transName);
        v.AddChild(new Control { CustomMinimumSize = new Vector2(0, 10) });
        _transTag = Text("", 15, InkDim, null, true, HorizontalAlignment.Center);
        _transTag.AddThemeConstantOverride("line_spacing", 5);
        var tagWrap = new CenterContainer { MouseFilter = Control.MouseFilterEnum.Ignore };
        _transTag.CustomMinimumSize = new Vector2(540, 0);
        tagWrap.AddChild(_transTag);
        v.AddChild(tagWrap);
    }

    public async Task PlayTransition(Era era, Func<Task> work)
    {
        _transYear.Text = era.YearLabel;
        _transName.Text = era.Name;
        _transTag.Text = era.Tagline;
        // era colours: a dim glow of the era's horizon in the middle, its sky toward the edges
        var g = _transGradient.Gradient;
        g.Colors = new[] { M.Col(M.Shade(era.Horizon, 0.32)), M.Col(M.Shade(era.Sky, 0.12)), new Color(0.01f, 0.01f, 0.015f) };
        _transitionFlash.Color = new Color(M.Col(M.Shade(era.Sun, 1.0)), 0);
        _transition.Modulate = new Color(1, 1, 1, 0);
        _transitionCard.Modulate = new Color(1, 1, 1, 0);
        _transition.Visible = true;
        await NextFrame();

        var tw = _transition.CreateTween();
        tw.TweenProperty(_transition, "modulate:a", 1.0f, 0.6f).SetTrans(Tween.TransitionType.Sine).SetEase(Tween.EaseType.InOut);
        var flash = _transitionFlash.CreateTween();
        flash.TweenProperty(_transitionFlash, "color:a", 0.45f, 0.35f).SetEase(Tween.EaseType.In);
        flash.TweenProperty(_transitionFlash, "color:a", 0.0f, 0.6f).SetEase(Tween.EaseType.Out);
        _transitionCard.PivotOffset = _transitionCard.Size / 2;
        _transitionCard.Scale = new Vector2(0.97f, 0.97f);
        var card = _transitionCard.CreateTween().SetParallel();
        card.TweenProperty(_transitionCard, "modulate:a", 1.0f, 0.7f).SetDelay(0.3f);
        card.TweenProperty(_transitionCard, "scale", Vector2.One, 1.6f).SetDelay(0.3f).SetTrans(Tween.TransitionType.Cubic).SetEase(Tween.EaseType.Out);
        await Wait(0.65);
        if (work != null) await work();
        await Wait(1.4);
        var outTw = _transition.CreateTween();
        outTw.TweenProperty(_transition, "modulate:a", 0.0f, 0.6f).SetTrans(Tween.TransitionType.Sine).SetEase(Tween.EaseType.InOut);
        await Wait(0.65);
        _transition.Visible = false;
    }

    async Task Wait(double seconds)
    {
        await ToSignal(GetTree().CreateTimer(seconds, true, false, true), SceneTreeTimer.SignalName.Timeout);
    }

    public async Task NextFrame()
    {
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
    }

    // =====================================================================================
    // Dev panel (devtools.ts)
    // =====================================================================================

    void BuildDev()
    {
        var sb = Box(new Color(12 / 255f, 14 / 255f, 20 / 255f, 0.86f), 7, 0, 0, new Color(1, 1, 1, 0.2f), 1);
        _dev = PanelOf(sb, Control.MouseFilterEnum.Stop);
        _dev.Name = "Dev";
        var v = VBox(0);
        _dev.AddChild(v);

        var headSb = Box(new Color(0, 0, 0, 0), 0, 9, 5);
        headSb.BorderColor = Hairline;
        headSb.BorderWidthBottom = 1;
        var head = PanelOf(headSb);
        var hh = HBox(6);
        var label = Text("DEV", 12, Accent, Spaced(_sansBold, 2));
        label.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        label.VerticalAlignment = VerticalAlignment.Center;
        hh.AddChild(label);
        _devToggle = new Button { Text = "−", ThemeTypeVariation = "DevButton", CustomMinimumSize = new Vector2(22, 22), FocusMode = Control.FocusModeEnum.None, TooltipText = "Toggle (backquote key)" };
        _devToggle.Pressed += ToggleDev;
        hh.AddChild(_devToggle);
        head.AddChild(hh);
        v.AddChild(head);

        var body = VBox(0);
        _devBody = body;
        var statsSb = Box(new Color(0, 0, 0, 0), 0, 9, 6);
        statsSb.BorderColor = Hairline;
        statsSb.BorderWidthBottom = 1;
        var stats = PanelOf(statsSb);
        _devStats = Text("", 12, InkDim, null, true);
        _devStats.CustomMinimumSize = new Vector2(176, 0);
        stats.AddChild(_devStats);
        body.AddChild(stats);

        var scroll = new ScrollContainer { HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled, MouseFilter = Control.MouseFilterEnum.Pass };
        _devScroll = scroll;
        var listPad = new MarginContainer { SizeFlagsHorizontal = Control.SizeFlags.ExpandFill, MouseFilter = Control.MouseFilterEnum.Ignore };
        foreach (var side in new[] { "left", "right", "top", "bottom" }) listPad.AddThemeConstantOverride("margin_" + side, 4);
        var list = VBox(2);
        list.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
        listPad.AddChild(list);
        scroll.AddChild(listPad);
        body.AddChild(scroll);
        v.AddChild(body);
        _devList = list;
        _root.AddChild(_dev);
    }

    VBoxContainer _devList;
    ScrollContainer _devScroll;
    bool _devListBuilt;

    void BuildDevEraList()
    {
        if (_devListBuilt || GameData.Eras == null) return;
        _devListBuilt = true;
        foreach (var era in GameData.Eras)
        {
            var b = new Button { Text = $"{era.YearLabel}  {era.Civ}", ThemeTypeVariation = "DevButton", Alignment = HorizontalAlignment.Left, FocusMode = Control.FocusModeEnum.None, SizeFlagsHorizontal = Control.SizeFlags.ExpandFill };
            string id = era.Id;
            b.Pressed += () => OnDevTravel?.Invoke(id);
            _devList.AddChild(b);
        }
    }

    /// <summary>Show or hide the whole dev panel (e.g. false for release builds).</summary>
    public bool DevVisible
    {
        get => _dev.Visible;
        set => _dev.Visible = value;
    }

    /// <summary>Collapse / expand the dev panel (backquote key or its button).</summary>
    public void ToggleDev()
    {
        _devOpen = !_devOpen;
        _devBody.Visible = _devOpen;
        _devToggle.Text = _devOpen ? "−" : "+";
    }

    public void SetDevStats(string text) => _devStats.Text = text;

    // =====================================================================================
    // Frame update, input, hit testing
    // =====================================================================================

    public override void _Ready()
    {
        BuildDevEraList();
    }

    public override void _Input(InputEvent e)
    {
        if (DevKeyEnabled && _dev.Visible && e is InputEventKey k && k.Pressed && !k.Echo && k.PhysicalKeycode == Key.Quoteleft)
        {
            ToggleDev();
            GetViewport().SetInputAsHandled();
        }
    }

    public override void _Process(double delta)
    {
        BuildDevEraList();
        var vs = _root.Size;

        if (_hud.Visible)
        {
            Place(_eraPanel, 14, 12);
            Place(_district, 16, 12 + _eraPanel.Size.Y + 6);
            _minimap.Position = new Vector2(vs.X - 14 - 170, 12);
            float stackTop = vs.Y; // keep prompt and dialogue above a tall (wrapped) objective
            if (_objective.Visible)
            {
                PlaceCentered(_objective, vs.X / 2, vs.Y - 18, true);
                stackTop = _objective.Position.Y;
            }
            if (_prompt.Visible) PlaceCentered(_prompt, vs.X / 2, Math.Min(vs.Y - 84, stackTop - 10), true);
            _dialogueBottom = Math.Min(vs.Y - 112, stackTop - 44);
            PlaceCentered(_toasts, vs.X / 2, 20, false);
        }

        if (_dialogue.Visible)
        {
            float w = Math.Min(780, vs.X * 0.92f);
            _dialogueText.CustomMinimumSize = new Vector2(w - 46, 50);
            PlaceCentered(_dialogue, vs.X / 2, _hud.Visible ? _dialogueBottom : vs.Y - 112, true);
            if (_typing)
            {
                _typePos += (float)delta * TYPE_SPEED;
                int total = _dialogueText.GetTotalCharacterCount();
                if (_typePos >= total) FinishTyping();
                else _dialogueText.VisibleCharacters = (int)_typePos;
            }
        }

        if (_dev.Visible)
        {
            if (_devOpen)
            {
                float want = _devList.GetCombinedMinimumSize().Y + 8;
                float max = Math.Max(120, vs.Y * 0.8f - 90);
                _devScroll.CustomMinimumSize = new Vector2(0, Math.Min(want, max));
            }
            _dev.Size = _dev.GetCombinedMinimumSize();
            _dev.Position = new Vector2(10, Mathf.Round((vs.Y - _dev.Size.Y) / 2));
        }

        if (_loading.Visible) _spinner.QueueRedraw();
    }

    float _dialogueBottom = 788;

    static void Place(Control c, float x, float y)
    {
        c.Size = c.GetCombinedMinimumSize();
        c.Position = new Vector2(x, y);
    }

    /// <summary>Sizes a floating control to its content and centres it horizontally on cx;
    /// y is its bottom edge when fromBottom, else its top edge.</summary>
    static void PlaceCentered(Control c, float cx, float y, bool fromBottom)
    {
        c.Size = c.GetCombinedMinimumSize();
        c.Position = new Vector2(Mathf.Round(cx - c.Size.X / 2), Mathf.Round(fromBottom ? y - c.Size.Y : y));
    }

    /// <summary>True when the pointer (viewport / canvas coordinates, e.g. InputEventMouse.Position or
    /// GetViewport().GetMousePosition()) is over an interactive UI element, or a modal screen is open.</summary>
    public bool PointerOverUI(Vector2 screenPos)
    {
        if (_title.Visible || _journal.Visible || _pause.Visible || _loading.Visible || _transition.Visible) return true;
        if (_dialogue.Visible && _dialogue.GetGlobalRect().HasPoint(screenPos)) return true;
        if (_dev.Visible && _dev.GetGlobalRect().HasPoint(screenPos)) return true;
        return false;
    }
}
