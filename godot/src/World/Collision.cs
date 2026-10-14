using System;

namespace Chronopolis;

/// <summary>
/// Oriented box collider on the ground plane. With a Top it is a walkable surface (floor, step,
/// terrace, deck) that only blocks when out of step reach; Slope makes it a ramp along local x.
/// </summary>
public class Collider
{
    public double X, Z, Hw, Hd, Rot;
    /// <summary>height of the obstacle above the ground (solid colliders)</summary>
    public double H;
    public string Tag;
    public double? Top;
    public double Slope;

    public Collider() { }
    public Collider(double x, double z, double hw, double hd, double rot, double h, string tag = null)
    {
        X = x; Z = z; Hw = hw; Hd = hd; Rot = rot; H = h; Tag = tag;
    }
}

public static class Collision
{
    /// <summary>How high the player can step up without jumping.</summary>
    public const double STEP_UP = 0.7;

    public static bool PointIn(Collider c, double px, double pz, double pad = 0)
    {
        double dx = px - c.X, dz = pz - c.Z;
        double cs = Math.Cos(-c.Rot), sn = Math.Sin(-c.Rot);
        double lx = dx * cs - dz * sn;
        double lz = dx * sn + dz * cs;
        return Math.Abs(lx) < c.Hw + pad && Math.Abs(lz) < c.Hd + pad;
    }

    public static double TopAt(Collider c, double px, double pz)
    {
        if (c.Top == null) return double.PositiveInfinity;
        if (c.Slope == 0) return c.Top.Value;
        double dx = px - c.X, dz = pz - c.Z;
        double lx = dx * Math.Cos(c.Rot) + dz * Math.Sin(c.Rot);
        return c.Top.Value + c.Slope * Math.Max(-c.Hw, Math.Min(c.Hw, lx));
    }

    /// <summary>Walkable collider from (ax,az) at height ya to (bx,bz) at height yb, `width` wide.</summary>
    public static Collider Ramp(double ax, double az, double ya, double bx, double bz, double yb, double width, string tag = null)
    {
        double len = M.Hypot(bx - ax, bz - az);
        if (len == 0) len = 1;
        return new Collider
        {
            X = (ax + bx) / 2, Z = (az + bz) / 2, Hw = len / 2, Hd = width / 2,
            Rot = Math.Atan2(bz - az, bx - ax), H = 0, Top = (ya + yb) / 2, Slope = (yb - ya) / len, Tag = tag,
        };
    }

    public static bool Blocks(Collider c, double px, double pz, double y)
    {
        if (c.Top != null) return TopAt(c, px, pz) > y + STEP_UP;
        return c.H >= 0.4;
    }

    /// <summary>Push a circle out of a collider. Returns the corrected position.</summary>
    public static (double, double) ResolveCircle(Collider c, double px, double pz, double r)
    {
        double dx = px - c.X, dz = pz - c.Z;
        double cs = Math.Cos(-c.Rot), sn = Math.Sin(-c.Rot);
        double lx = dx * cs - dz * sn;
        double lz = dx * sn + dz * cs;
        double ox = c.Hw + r - Math.Abs(lx);
        double oz = c.Hd + r - Math.Abs(lz);
        if (ox <= 0 || oz <= 0) return (px, pz);
        if (ox < oz) lx += ox * (lx < 0 ? -1 : 1);
        else lz += oz * (lz < 0 ? -1 : 1);
        double cs2 = Math.Cos(c.Rot), sn2 = Math.Sin(c.Rot);
        return (c.X + lx * cs2 - lz * sn2, c.Z + lx * sn2 + lz * cs2);
    }
}
