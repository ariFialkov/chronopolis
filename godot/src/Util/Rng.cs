using System;

namespace Chronopolis;

/// <summary>
/// Deterministic random helpers, bit-for-bit identical to the original TypeScript (src/util/rng.ts)
/// so the city is laid out exactly as before: JavaScript's int32 / uint32 conversions and
/// double-precision products are reproduced here.
/// </summary>
public static class Hash
{
    /// <summary>JavaScript ToInt32 of a double.</summary>
    public static int ToInt32(double d)
    {
        // fast path: truncation to long then wrap to 32 bits is exactly JS ToInt32 in this range
        if (d > -9.2e18 && d < 9.2e18) return unchecked((int)(long)d);
        if (double.IsNaN(d) || double.IsInfinity(d)) return 0;
        double t = Math.Truncate(d) % 4294967296.0;
        return unchecked((int)(uint)(long)t);
    }

    /// <summary>JavaScript ToUint32 of a double.</summary>
    public static uint ToUint32(double d) => unchecked((uint)ToInt32(d));

    public static double Hash2(double x, double y, double seed = 0)
    {
        double h0 = (double)ToInt32(x) * 374761393.0 + (double)ToInt32(y) * 668265263.0 + (double)ToInt32(seed) * 1274126177.0;
        int a = ToInt32(h0) ^ (int)(ToUint32(h0) >> 13);
        double p = (double)a * 1103515245.0;
        int h = ToInt32(p) ^ (int)(ToUint32(p) >> 16);
        return unchecked((uint)h) / 4294967296.0;
    }

    public static double Hash3(double x, double y, double z, double seed = 0) => Hash2(x * 31 + z * 7, y * 17 - z * 3, seed + z * 101);

    public static uint HashStr(string s)
    {
        uint h = 2166136261;
        foreach (char ch in s)
        {
            h ^= ch;
            h = unchecked(h * 16777619);
        }
        return h;
    }

    static double Smooth(double t) => t * t * (3 - 2 * t);

    /// <summary>2D value noise in [0,1].</summary>
    public static double Noise2(double x, double y, double seed = 0)
    {
        double xi = Math.Floor(x);
        double yi = Math.Floor(y);
        double tx = Smooth(x - xi);
        double ty = Smooth(y - yi);
        double a = Hash2(xi, yi, seed);
        double b = Hash2(xi + 1, yi, seed);
        double c = Hash2(xi, yi + 1, seed);
        double d = Hash2(xi + 1, yi + 1, seed);
        return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }

    /// <summary>Fractal noise in [0,1].</summary>
    public static double Fbm(double x, double y, int octaves = 3, double seed = 0)
    {
        double v = 0, amp = 0.5, f = 1, sum = 0;
        for (int i = 0; i < octaves; i++)
        {
            v += Noise2(x * f, y * f, seed + i * 7) * amp;
            sum += amp;
            amp *= 0.5;
            f *= 2;
        }
        return v / sum;
    }
}

/// <summary>Small fast PRNG (mulberry32), identical to the TypeScript version.</summary>
public sealed class Rng
{
    uint s;

    public Rng(double seed) { s = Hash.ToUint32(seed); }

    public double Next()
    {
        unchecked
        {
            s += 0x6d2b79f5;
            int t = (int)s;
            t = (t ^ (int)((uint)t >> 15)) * (t | 1);
            t ^= t + (t ^ (int)((uint)t >> 7)) * (t | 61);
            return (uint)(t ^ (int)((uint)t >> 14)) / 4294967296.0;
        }
    }

    public double Range(double a, double b) => a + (b - a) * Next();
    public int Int(int a, int b) => (int)Math.Floor(Range(a, b + 1));
    public bool Chance(double p) => Next() < p;
    public T Pick<T>(System.Collections.Generic.IReadOnlyList<T> arr) => arr[(int)Math.Floor(Next() * arr.Count)];

    public T Weighted<T>(System.Collections.Generic.IReadOnlyList<T> arr, Func<T, double> weight)
    {
        double total = 0;
        foreach (var a in arr) total += weight(a);
        double r = Next() * total;
        foreach (var a in arr)
        {
            r -= weight(a);
            if (r <= 0) return a;
        }
        return arr[arr.Count - 1];
    }
}
