using System;
using System.Collections.Generic;
using Godot;

namespace Chronopolis;

/// <summary>Third-person orbit camera that follows the player and avoids clipping into buildings.</summary>
public sealed class CameraRig
{
    public readonly Camera3D Camera;
    public double Yaw = Math.PI;
    public double Pitch = 0.32;
    public double Distance = 7.5;
    double _targetDistance = 7.5;
    Vector3 _smoothed;
    bool _initialised;

    public CameraRig(Camera3D camera)
    {
        Camera = camera;
        Camera.Fov = 62;
        Camera.Near = 0.2f;
        Camera.Far = 1800;
    }

    public void Rotate(double dx, double dy)
    {
        Yaw -= dx * 0.0032;
        Pitch = M.Clamp(Pitch + dy * 0.0028, -0.25, 1.2);
    }

    public void SetDistance(double d) => Distance = _targetDistance = M.Clamp(d, 3, 16);

    public void ZoomBy(double delta) => _targetDistance = M.Clamp(_targetDistance + delta * 1.1, 3, 16);

    /// <summary>Forward direction on the ground plane (for movement relative to camera).</summary>
    public (double X, double Z) Forward() => (-Math.Sin(Yaw), -Math.Cos(Yaw));

    public void Update(double tx, double ty, double tz, double dt, List<Collider> colliders, Func<double, double, double> groundAt)
    {
        Distance = M.Lerp(Distance, _targetDistance, 1 - Math.Exp(-dt * 6));
        var t = new Vector3((float)tx, (float)(ty + 1.7), (float)tz);
        if (!_initialised)
        {
            _smoothed = t;
            _initialised = true;
        }
        else _smoothed = _smoothed.Lerp(t, (float)(1 - Math.Exp(-dt * 14)));
        double dX = Math.Sin(Yaw) * Math.Cos(Pitch), dY = Math.Sin(Pitch), dZ = Math.Cos(Yaw) * Math.Cos(Pitch);
        // shorten the boom if it would end up inside a building
        double d = Distance;
        for (int i = 0; i < 10; i++)
        {
            double px = _smoothed.X + dX * d, pz = _smoothed.Z + dZ * d;
            bool hit = false;
            foreach (var c in colliders)
            {
                double cy = _smoothed.Y + dY * d;
                bool tall = c.Top.HasValue ? Collision.TopAt(c, px, pz) > cy - 0.3 : c.H > cy - groundAt(px, pz);
                if (tall && Collision.PointIn(c, px, pz, 0.4))
                {
                    hit = true;
                    break;
                }
            }
            if (!hit) break;
            d *= 0.82;
        }
        var pos = _smoothed + new Vector3((float)(dX * d), (float)(dY * d), (float)(dZ * d));
        float g = (float)groundAt(pos.X, pos.Z) + 0.6f;
        if (pos.Y < g) pos.Y = g;
        Camera.Position = pos;
        if (pos.DistanceSquaredTo(_smoothed) > 1e-6f) Camera.LookAt(_smoothed, Vector3.Up);
    }

    public void SnapTo(double x, double y, double z)
    {
        _smoothed = new Vector3((float)x, (float)(y + 1.7), (float)z);
        _initialised = true;
    }
}
