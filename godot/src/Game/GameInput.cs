using System;
using System.Collections.Generic;
using Godot;

namespace Chronopolis;

/// <summary>
/// Unified input: keyboard + mouse, and any gamepad. The key set is deliberately tiny.
/// E (or the gamepad's X / Square) is "do the thing", whatever the thing is.
/// </summary>
public sealed class GameInput
{
    public double MoveX, MoveY;   // -1..1 strafe / forward
    public double LookX, LookY;   // pixels-equivalent accumulated this frame
    public double Zoom;           // wheel steps this frame
    public bool Sprint, Jump, Interact, Map, Pause, DevToggle, Any;
    /// <summary>When true, movement and look are ignored (menus open) but edges still fire.</summary>
    public bool Blocked;

    readonly HashSet<Key> _keys = new();
    readonly HashSet<string> _edges = new();
    double _mouseX, _mouseY, _wheel;
    bool _padSprint;

    public bool Captured => Input.MouseMode == Input.MouseModeEnum.Captured;

    public void Capture()
    {
        if (!Blocked) Input.MouseMode = Input.MouseModeEnum.Captured;
    }

    public void Release() => Input.MouseMode = Input.MouseModeEnum.Visible;

    /// <summary>Feed every input event here (from _Input).</summary>
    public void Handle(InputEvent e)
    {
        switch (e)
        {
            case InputEventKey k:
                if (k.Pressed && !k.Echo)
                {
                    _keys.Add(k.PhysicalKeycode);
                    string edge = k.PhysicalKeycode switch
                    {
                        Key.Space => "jump",
                        Key.E or Key.Enter or Key.KpEnter => "interact",
                        Key.M or Key.Tab => "map",
                        Key.Escape => "pause",
                        Key.Quoteleft => "dev",
                        _ => "key",
                    };
                    _edges.Add(edge);
                }
                else if (!k.Pressed) _keys.Remove(k.PhysicalKeycode);
                break;
            case InputEventMouseMotion m when Captured:
                _mouseX += m.Relative.X;
                _mouseY += m.Relative.Y;
                break;
            case InputEventMouseButton b when b.Pressed:
                if (b.ButtonIndex == MouseButton.WheelUp) _wheel -= 1;
                else if (b.ButtonIndex == MouseButton.WheelDown) _wheel += 1;
                break;
            case InputEventJoypadButton jb when jb.Pressed:
                string pe = jb.ButtonIndex switch
                {
                    JoyButton.A => "jump",
                    JoyButton.X or JoyButton.B => "interact",
                    JoyButton.Back or JoyButton.Y => "map",
                    JoyButton.Start => "pause",
                    JoyButton.LeftStick => "sprint",
                    _ => "key",
                };
                if (pe == "sprint") _padSprint = !_padSprint;
                else _edges.Add(pe);
                break;
        }
    }

    static double Dead(double v, double dz = 0.18) => Math.Abs(v) < dz ? 0 : (v - Math.Sign(v) * dz) / (1 - dz);

    /// <summary>Call once per frame before reading state.</summary>
    public void Poll(double dt)
    {
        double mx = 0, my = 0;
        double padX = Dead(Input.GetJoyAxis(0, JoyAxis.LeftX));
        double padY = Dead(Input.GetJoyAxis(0, JoyAxis.LeftY));
        if (!Blocked)
        {
            if (_keys.Contains(Key.W) || _keys.Contains(Key.Up)) my += 1;
            if (_keys.Contains(Key.S) || _keys.Contains(Key.Down)) my -= 1;
            if (_keys.Contains(Key.D) || _keys.Contains(Key.Right)) mx += 1;
            if (_keys.Contains(Key.A) || _keys.Contains(Key.Left)) mx -= 1;
            mx += padX;
            my -= padY;
        }
        double len = Math.Sqrt(mx * mx + my * my);
        if (len > 1) { mx /= len; my /= len; }
        if (len < 0.05) _padSprint = false;
        MoveX = mx;
        MoveY = my;
        Sprint = _keys.Contains(Key.Shift) || _padSprint || Input.GetJoyAxis(0, JoyAxis.TriggerLeft) > 0.5;
        Jump = _edges.Contains("jump");
        Interact = _edges.Contains("interact");
        Map = _edges.Contains("map");
        Pause = _edges.Contains("pause");
        DevToggle = _edges.Contains("dev");
        Any = _edges.Count > 0;
        // right stick looks around at a steady rate, the same scale as mouse pixels
        double rx = Dead(Input.GetJoyAxis(0, JoyAxis.RightX)), ry = Dead(Input.GetJoyAxis(0, JoyAxis.RightY));
        LookX = _mouseX + rx * 900 * dt;
        LookY = _mouseY + ry * 600 * dt;
        Zoom = _wheel;
        if (Blocked) { LookX = 0; LookY = 0; Zoom = 0; }
    }

    /// <summary>Call at end of frame.</summary>
    public void EndFrame()
    {
        _edges.Clear();
        _mouseX = _mouseY = _wheel = 0;
        LookX = LookY = Zoom = 0;
    }

    /// <summary>Drop held keys (focus lost, menus opened).</summary>
    public void ClearKeys() => _keys.Clear();
}
