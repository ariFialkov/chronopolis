using System;
using System.Collections.Generic;
using Godot;

namespace Chronopolis;

/// <summary>Eli: the player character. Walks, runs, jumps, climbs steps and stands on any walkable surface.</summary>
public partial class Player : Node3D
{
    public const double RADIUS = 0.42;
    public double X, Y, Z, Yaw, Vy, Speed;
    public bool Grounded = true;
    public Character Figure { get; private set; }
    string _eraId = "";
    readonly List<Collider> _tmp = new();

    public Player()
    {
        Name = "Player";
        SetEra("industrial");
    }

    /// <summary>Eli changes clothes to blend into each era.</summary>
    public void SetEra(string eraId)
    {
        if (eraId == _eraId) return;
        _eraId = eraId;
        var outfit = (GameData.Cast.TryGetValue(eraId, out var c) ? c : GameData.Cast["industrial"]).Player;
        var next = new Character(outfit, $"player:{eraId}");
        Figure?.QueueFree();
        Figure = next;
        AddChild(next.Root);
    }

    public void Teleport(double x, double z, World world)
    {
        X = x;
        Z = z;
        Y = world.GroundY(x, z);
        Vy = 0;
        Grounded = true;
        Sync();
    }

    void Sync()
    {
        Position = new Vector3((float)X, (float)Y, (float)Z);
        Rotation = new Vector3(0, (float)Yaw, 0);
    }

    public void Step(double dt, double moveX, double moveY, bool sprint, bool jump, (double X, double Z) camForward, World world)
    {
        var (fx, fz) = camForward;
        double rx = -fz, rz = fx;
        double dx = fx * moveY + rx * moveX;
        double dz = fz * moveY + rz * moveX;
        double len = M.Hypot(dx, dz);
        double target = sprint ? 17 : 9.2;
        if (len > 0.01)
        {
            dx /= len;
            dz /= len;
            double desired = target * Math.Min(1, len);
            Speed += (desired - Speed) * Math.Min(1, dt * 10);
            Yaw = M.AngleLerp(Yaw, Math.Atan2(dx, dz), Math.Min(1, dt * 12));
        }
        else Speed += (0 - Speed) * Math.Min(1, dt * 12);

        double nx = X + Math.Sin(Yaw) * Speed * dt;
        double nz = Z + Math.Cos(Yaw) * Speed * dt;
        // water and world edge: water blocks unless there is a deck to walk on
        if (Macro.WaterDepth(nx, nz) > -1.5 && world.GroundY(nx, nz, Y) < -0.5)
        {
            if (Macro.WaterDepth(nx, Z) <= -1.5 || world.GroundY(nx, Z, Y) >= -0.5) nz = Z;
            else if (Macro.WaterDepth(X, nz) <= -1.5 || world.GroundY(X, nz, Y) >= -0.5) nx = X;
            else { nx = X; nz = Z; }
        }
        nx = Math.Max(-Macro.WORLD_HALF + 2, Math.Min(Macro.WORLD_HALF - 2, nx));
        nz = Math.Max(-Macro.WORLD_HALF + 2, Math.Min(Macro.WORLD_HALF - 2, nz));
        // collisions: solid colliders always block; floors and steps only when out of step reach
        var cols = world.CollidersNear(nx, nz, RADIUS + 1, _tmp);
        for (int pass = 0; pass < 2; pass++)
            foreach (var c in cols)
            {
                if (!Collision.Blocks(c, nx, nz, Y)) continue;
                (nx, nz) = Collision.ResolveCircle(c, nx, nz, RADIUS);
            }
        X = nx;
        Z = nz;
        // vertical: step up onto anything within reach, fall off ledges
        double ground = world.GroundY(X, Z, Y);
        if (jump && Grounded)
        {
            Vy = 5.2;
            Grounded = false;
        }
        Vy -= 14 * dt;
        Y += Vy * dt;
        if (Y <= ground)
        {
            Y = ground;
            Vy = 0;
            Grounded = true;
        }
        else if (Grounded && Y - ground < 0.35 && Vy <= 0)
        {
            // stick to the ground going down slopes and steps instead of hopping
            Y = ground;
            Vy = 0;
        }
        else if (Y - ground > 0.05) Grounded = false;
        Sync();
        Figure.Animate(dt, Grounded ? Speed : 0);
    }

    /// <summary>Idle animation while menus or dialogue are up.</summary>
    public void Idle(double dt) => Figure.Animate(dt, 0);
}
