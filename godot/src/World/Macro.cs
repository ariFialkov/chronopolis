using System;
using System.Collections.Generic;

namespace Chronopolis;

/// <summary>Ground-plane point.</summary>
public readonly record struct P2(double X, double Z);

public sealed class Site
{
    public string Id;
    public double X, Z;
    /// <summary>Radius kept clear of ordinary buildings.</summary>
    public double Clear;
    public string Label;
}

public sealed class District
{
    public string Id;
    public double X, Z, Radius;
}

/// <summary>
/// The macro layout of Chronopolis: the geography that stays constant across every era. The river,
/// the bay, the citadel hill, the great arterial roads and the sacred sites are the bones of the city.
/// </summary>
public static class Macro
{
    public const double WORLD_HALF = 820;
    public const double CHUNK_SIZE = 80;
    public const double RING_ROAD = 620;
    public const double ARTERIAL_WIDTH = 14;
    public const double RIVER_HALF_WIDTH = 34;
    public const double TERRAIN_CELL = 5;
    public const double WATER_LEVEL = -0.8;

    public static readonly P2[] RIVER =
    {
        new(-70, -900), new(-55, -620), new(-30, -420), new(20, -240), new(60, -60),
        new(55, 120), new(20, 300), new(-10, 430), new(-20, 560),
    };

    public static class HILL
    {
        public const double X = 380, Z = -340, Radius = 230, Plateau = 110, Height = 26;
    }

    public static readonly Dictionary<string, Site> SITES = new()
    {
        ["citadel"] = new Site { Id = "citadel", X = HILL.X, Z = HILL.Z, Clear = 120, Label = "Citadel Hill" },
        ["plaza"] = new Site { Id = "plaza", X = -140, Z = -120, Clear = 72, Label = "Great Plaza" },
        ["harbor"] = new Site { Id = "harbor", X = 160, Z = 470, Clear = 90, Label = "Old Harbor" },
        ["arena"] = new Site { Id = "arena", X = 430, Z = 210, Clear = 95, Label = "Arena Grounds" },
        ["sacred"] = new Site { Id = "sacred", X = -480, Z = -470, Clear = 85, Label = "Sacred Ground" },
        ["market"] = new Site { Id = "market", X = -330, Z = 170, Clear = 55, Label = "Market Square" },
        ["gate"] = new Site { Id = "gate", X = -220, Z = -620, Clear = 30, Label = "North Gate" },
    };
    /// <summary>Sites in the original declaration order (iteration order matters for determinism).</summary>
    public static readonly string[] SITE_ORDER = { "citadel", "plaza", "harbor", "arena", "sacred", "market", "gate" };

    public static readonly District[] DISTRICTS =
    {
        new() { Id = "citadel", X = 380, Z = -340, Radius = 260 },
        new() { Id = "oldtown", X = -150, Z = -150, Radius = 260 },
        new() { Id = "harbor", X = 120, Z = 420, Radius = 220 },
        new() { Id = "eastside", X = 420, Z = 150, Radius = 240 },
        new() { Id = "westmarket", X = -380, Z = 150, Radius = 240 },
        new() { Id = "north", X = -350, Z = -450, Radius = 240 },
        new() { Id = "fields", X = 0, Z = 0, Radius = 9999 },
    };

    public static readonly P2[][] ARTERIALS =
    {
        new P2[] { new(-220, -820), new(-220, 820) },
        new P2[] { new(200, -820), new(200, 820) },
        new P2[] { new(-820, -120), new(820, -120) },
        new P2[] { new(-820, 330), new(820, 330) },
        new P2[] { new(-RING_ROAD, -RING_ROAD), new(RING_ROAD, -RING_ROAD), new(RING_ROAD, RING_ROAD), new(-RING_ROAD, RING_ROAD), new(-RING_ROAD, -RING_ROAD) },
        new P2[] { new(380, -120), new(380, -250) },
        new P2[] { new(200, 330), new(160, 430) },
    };

    /// <summary>Coastline: water where z &gt; CoastZ(x).</summary>
    public static double CoastZ(double x) =>
        540 + 40 * Math.Sin(x / 170) + 18 * Math.Sin(x / 61 + 1.3) - M.Clamp((Math.Abs(x + 20) - 120) * -0.25, -40, 0);

    public static string DistrictAt(double x, double z)
    {
        string best = "fields";
        double bestD = double.PositiveInfinity;
        foreach (var d in DISTRICTS)
        {
            if (d.Id == "fields") continue;
            double dd = M.Hypot(x - d.X, z - d.Z);
            if (dd < d.Radius && dd < bestD)
            {
                bestD = dd;
                best = d.Id;
            }
        }
        return best;
    }

    public static double RiverDistance(double x, double z)
    {
        double best = double.PositiveInfinity;
        for (int i = 0; i < RIVER.Length - 1; i++)
        {
            double d = M.SegDist(x, z, RIVER[i].X, RIVER[i].Z, RIVER[i + 1].X, RIVER[i + 1].Z);
            if (d < best) best = d;
        }
        return best;
    }

    public static double ArterialDistance(double x, double z)
    {
        double best = double.PositiveInfinity;
        foreach (var line in ARTERIALS)
            for (int i = 0; i < line.Length - 1; i++)
            {
                double d = M.SegDist(x, z, line[i].X, line[i].Z, line[i + 1].X, line[i + 1].Z);
                if (d < best) best = d;
            }
        return best;
    }

    public static bool IsArterial(double x, double z, double width = ARTERIAL_WIDTH) => ArterialDistance(x, z) < width / 2;

    /// <summary>Signed water measure: &gt; 0 means water.</summary>
    public static double WaterDepth(double x, double z)
    {
        double sea = z - CoastZ(x);
        double river = RIVER_HALF_WIDTH + 6 * Math.Sin(z * 0.05) - RiverDistance(x, z);
        return Math.Max(sea, river);
    }

    public static bool IsWater(double x, double z) => WaterDepth(x, z) > 0;

    /// <summary>Terrain before landmark flattening.</summary>
    public static double RawHeight(double x, double z)
    {
        double h = 5 + (Hash.Fbm(x * 0.0036 + 3.1, z * 0.0036 + 7.7, 3, 21) - 0.5) * 17;
        h += (Hash.Fbm(x * 0.013 + 1.3, z * 0.013 + 2.9, 2, 23) - 0.5) * 3.2;
        double rd = RiverDistance(x, z);
        h -= 3.5 * (1 - M.Smoothstep(40, 260, rd));
        if (h < 1.2) h = 1.2 - (1.2 - h) * 0.15;
        double dh = M.Hypot(x - HILL.X, z - HILL.Z);
        if (dh < HILL.Radius) h += HILL.Height * (1 - M.Smoothstep(HILL.Plateau, HILL.Radius, dh));
        double outside = Math.Max(Math.Abs(x), Math.Abs(z)) - RING_ROAD;
        if (outside > 0) h += (Hash.Fbm(x * 0.004, z * 0.004, 2, 9) - 0.5) * 12 * M.Smoothstep(0, 120, outside);
        return h;
    }

    static readonly Dictionary<string, double> siteBase = new();
    static double SiteBase(Site s)
    {
        lock (siteBase)
        {
            if (!siteBase.TryGetValue(s.Id, out double v))
            {
                v = RawHeight(s.X, s.Z);
                siteBase[s.Id] = v;
            }
            return v;
        }
    }

    /// <summary>Final terrain height: raw hills, landmark sites flattened, shores shelving into water.</summary>
    public static double TerrainHeight(double x, double z)
    {
        double h = RawHeight(x, z);
        foreach (var id in SITE_ORDER)
        {
            var s = SITES[id];
            double d = M.Hypot(x - s.X, z - s.Z);
            double outer = s.Clear * 1.4;
            if (d < outer)
            {
                double t = 1 - M.Smoothstep(s.Clear * 0.95, outer, d);
                h += (SiteBase(s) - h) * t;
            }
        }
        double wd = WaterDepth(x, z);
        if (wd > -16)
        {
            double t = M.Smoothstep(-16, 10, wd);
            h = h * (1 - t) - 3.5 * t;
        }
        return h;
    }

    /// <summary>Height of the rendered terrain surface (the triangle of the 5 m cell).</summary>
    public static double MeshHeight(double x, double z)
    {
        const double g = TERRAIN_CELL;
        double ax = Math.Floor(x / g) * g;
        double az = Math.Floor(z / g) * g;
        double u = (x - ax) / g;
        double v = (z - az) / g;
        double ya = TerrainHeight(ax, az);
        double yb = TerrainHeight(ax, az + g);
        double yc = TerrainHeight(ax + g, az + g);
        double yd = TerrainHeight(ax + g, az);
        if (v >= u) return ya + (yc - yb) * u + (yb - ya) * v;
        return ya + (yd - ya) * u + (yc - yd) * v;
    }

    public static Site SiteClearance(double x, double z)
    {
        foreach (var id in SITE_ORDER)
        {
            var s = SITES[id];
            if (M.Hypot(x - s.X, z - s.Z) < s.Clear) return s;
        }
        return null;
    }

    public static bool InsideCity(double x, double z) => Math.Abs(x) < RING_ROAD && Math.Abs(z) < RING_ROAD;
}
