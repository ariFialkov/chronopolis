using System;
using Godot;

namespace Chronopolis;

public static class M
{
    public const double PI = Math.PI;
    public static double Clamp(double v, double a, double b) => v < a ? a : v > b ? b : v;
    public static double Lerp(double a, double b, double t) => a + (b - a) * t;
    public static double Smoothstep(double a, double b, double v)
    {
        double t = Clamp((v - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
    }
    public static double Hypot(double a, double b) => Math.Sqrt(a * a + b * b);
    public static double Hypot(double a, double b, double c) => Math.Sqrt(a * a + b * b + c * c);
    /// <summary>JavaScript Math.round (halves round up).</summary>
    public static double Round(double v) => Math.Floor(v + 0.5);

    /// <summary>Shade a 24-bit colour by a factor (1 = unchanged), like the TypeScript shade().</summary>
    public static int Shade(int color, double f)
    {
        int r = (int)Clamp(((color >> 16) & 255) * f, 0, 255);
        int g = (int)Clamp(((color >> 8) & 255) * f, 0, 255);
        int b = (int)Clamp((color & 255) * f, 0, 255);
        return (r << 16) | (g << 8) | b;
    }

    public static int MixColor(int a, int b, double t)
    {
        int r = (int)Lerp((a >> 16) & 255, (b >> 16) & 255, t);
        int g = (int)Lerp((a >> 8) & 255, (b >> 8) & 255, t);
        int bl = (int)Lerp(a & 255, b & 255, t);
        return (r << 16) | (g << 8) | bl;
    }

    public static double AngleLerp(double a, double b, double t)
    {
        double d = b - a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return a + d * t;
    }

    /// <summary>Distance from a point to a segment (2D).</summary>
    public static double SegDist(double px, double pz, double ax, double az, double bx, double bz)
    {
        double vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
        double len2 = vx * vx + vz * vz;
        double t = len2 > 0 ? (wx * vx + wz * vz) / len2 : 0;
        t = Clamp(t, 0, 1);
        return Hypot(px - (ax + vx * t), pz - (az + vz * t));
    }

    /// <summary>sRGB 0xRRGGBB to a Godot colour.</summary>
    public static Color Col(int hex, float a = 1f) => new(((hex >> 16) & 255) / 255f, ((hex >> 8) & 255) / 255f, (hex & 255) / 255f, a);
}
