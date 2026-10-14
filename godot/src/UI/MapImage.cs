using System;
using System.Threading.Tasks;
using Godot;

namespace Chronopolis;

/// <summary>
/// Renders a top-down raster of the whole city for an era: water, roads, blocks, sites.
/// (Port of src/world/mapImage.ts. The canvas 2D calls are replaced by a CPU rasteriser that writes
/// straight into an RGBA8 Godot Image; filled shapes are anti-aliased by 4x4 supersampling, close to
/// what the browser canvas does. Text labels are drawn by the UI on top of the texture.)
/// </summary>
public static class MapImage
{
    public const int MAP_PX = 420;
    /// <summary>Pixels per meter.</summary>
    public static readonly double MAP_SCALE = MAP_PX / (Macro.WORLD_HALF * 2);

    public static (double, double) WorldToMap(double x, double z) =>
        ((x + Macro.WORLD_HALF) * MAP_SCALE, (z + Macro.WORLD_HALF) * MAP_SCALE);

    const int SS = 4; // supersamples per axis for shape coverage

    /// <summary>Renders the map and uploads it as a texture (main thread).</summary>
    public static ImageTexture RenderEraMap(Era era) => ImageTexture.CreateFromImage(RenderEraMapImage(era));

    /// <summary>CPU part of <see cref="RenderEraMap"/>. Touches no scene or rendering state, so it may
    /// run on a worker thread (e.g. inside the era transition) with the texture created afterwards.</summary>
    public static Image RenderEraMapImage(Era era)
    {
        var data = new byte[MAP_PX * MAP_PX * 4];
        var pattern = Chronopolis.Pattern.MakePattern(era);
        int ground = era.Ground;
        int water = era.Water;
        int road = era.Layout.PavedArterials ? era.Road : era.Dirt;
        int streetCol = M.Shade(road, 1.12);

        // Every pixel is a pure function of its position, so rows can be filled in parallel.
        Parallel.For(0, MAP_PX, py =>
        {
            for (int px = 0; px < MAP_PX; px++)
            {
                double x = px / MAP_SCALE - Macro.WORLD_HALF;
                double z = py / MAP_SCALE - Macro.WORLD_HALF;
                int c = ground;
                if (Macro.IsWater(x, z)) c = water;
                else
                {
                    double h = Macro.TerrainHeight(x, z);
                    double u = Chronopolis.Pattern.Urbanity(era, x, z);
                    double f = 1 + (Hash.Hash2(px, py, 5) - 0.5) * 0.1 - (h > 4 ? Math.Min(0.3, h / 80) : 0) + (u < 0.2 && era.Layout.Fields ? 0.08 : 0);
                    c = M.Shade(c, f);
                    if (Macro.IsArterial(x, z, Macro.ARTERIAL_WIDTH + 2)) c = road;
                    else if (u > 0.15 && pattern.IsStreet(x, z)) c = streetCol;
                }
                int i = (py * MAP_PX + px) * 4;
                data[i] = (byte)((c >> 16) & 255);
                data[i + 1] = (byte)((c >> 8) & 255);
                data[i + 2] = (byte)(c & 255);
                data[i + 3] = 255;
            }
        });

        // building blocks
        var lots = pattern.LotsInRect(-Macro.WORLD_HALF, -Macro.WORLD_HALF, Macro.WORLD_HALF, Macro.WORLD_HALF);
        int block = M.Shade(era.Buildings[0].WallColors[0], 0.8);
        foreach (var lot in lots)
        {
            double p = World.LotBuildChance(era, lot);
            if (Hash.Hash2(M.Round(lot.X * 10), M.Round(lot.Z * 10), 9) > p) continue;
            double hw = lot.W * 0.5 * 0.95;
            double hd = lot.D * 0.5 * 0.95;
            if (!World.LotIsClear(lot, hw, hd, pattern)) continue;
            var (mx, my) = WorldToMap(lot.X, lot.Z);
            FillRotatedRect(data, mx, my, lot.Rot, hw * MAP_SCALE * 0.8, hd * MAP_SCALE * 0.8, block, 1.0);
        }

        // sites
        foreach (var id in Macro.SITE_ORDER)
        {
            var s = Macro.SITES[id];
            var (mx, my) = WorldToMap(s.X, s.Z);
            FillCircle(data, mx, my, s.Clear * MAP_SCALE * 0.6, 0xffffff, 0.35);
        }

        return Image.CreateFromData(MAP_PX, MAP_PX, false, Image.Format.Rgba8, data);
    }

    /// <summary>ctx.translate(cx,cy); ctx.rotate(rot); ctx.fillRect(-ex,-ey,2ex,2ey), anti-aliased.</summary>
    static void FillRotatedRect(byte[] data, double cx, double cy, double rot, double ex, double ey, int color, double alpha)
    {
        double cs = Math.Cos(rot), sn = Math.Sin(rot);
        double rx = Math.Abs(ex * cs) + Math.Abs(ey * sn);
        double ry = Math.Abs(ex * sn) + Math.Abs(ey * cs);
        int x0 = Math.Max(0, (int)Math.Floor(cx - rx)), x1 = Math.Min(MAP_PX - 1, (int)Math.Floor(cx + rx));
        int y0 = Math.Max(0, (int)Math.Floor(cy - ry)), y1 = Math.Min(MAP_PX - 1, (int)Math.Floor(cy + ry));
        for (int py = y0; py <= y1; py++)
            for (int px = x0; px <= x1; px++)
            {
                int hits = 0;
                for (int sy = 0; sy < SS; sy++)
                    for (int sx = 0; sx < SS; sx++)
                    {
                        double dx = px + (sx + 0.5) / SS - cx;
                        double dy = py + (sy + 0.5) / SS - cy;
                        // inverse rotation into rect space
                        double lx = dx * cs + dy * sn;
                        double ly = -dx * sn + dy * cs;
                        if (lx >= -ex && lx < ex && ly >= -ey && ly < ey) hits++;
                    }
                if (hits > 0) Blend(data, px, py, color, alpha * hits / (SS * SS));
            }
    }

    static void FillCircle(byte[] data, double cx, double cy, double r, int color, double alpha)
    {
        int x0 = Math.Max(0, (int)Math.Floor(cx - r)), x1 = Math.Min(MAP_PX - 1, (int)Math.Floor(cx + r));
        int y0 = Math.Max(0, (int)Math.Floor(cy - r)), y1 = Math.Min(MAP_PX - 1, (int)Math.Floor(cy + r));
        double r2 = r * r;
        for (int py = y0; py <= y1; py++)
            for (int px = x0; px <= x1; px++)
            {
                int hits = 0;
                for (int sy = 0; sy < SS; sy++)
                    for (int sx = 0; sx < SS; sx++)
                    {
                        double dx = px + (sx + 0.5) / SS - cx;
                        double dy = py + (sy + 0.5) / SS - cy;
                        if (dx * dx + dy * dy < r2) hits++;
                    }
                if (hits > 0) Blend(data, px, py, color, alpha * hits / (SS * SS));
            }
    }

    static void Blend(byte[] data, int px, int py, int color, double a)
    {
        int i = (py * MAP_PX + px) * 4;
        double r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
        data[i] = (byte)Math.Round(data[i] + (r - data[i]) * a);
        data[i + 1] = (byte)Math.Round(data[i + 1] + (g - data[i + 1]) * a);
        data[i + 2] = (byte)Math.Round(data[i + 2] + (b - data[i + 2]) * a);
    }
}
