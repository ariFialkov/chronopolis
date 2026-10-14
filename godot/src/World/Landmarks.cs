using System;
using System.Collections.Generic;

namespace Chronopolis;

/// <summary>
/// Landmark generators. Each era places its own monument on the same sacred ground:
/// the ziggurat, the pyramid, the Parthenon, the castle and the city hall all stand on Citadel Hill.
/// (Port of landmarks.ts.)
/// </summary>
public static class Landmarks
{
    static readonly Dictionary<string, int> LANDMARK_TILE = new()
    {
        ["ziggurat"] = Tile.MUDBRICK, ["ziggurat_small"] = Tile.MUDBRICK, ["temple_sumer"] = Tile.MUDBRICK, ["palace_assyria"] = Tile.MUDBRICK, ["lamassu_gate"] = Tile.MUDBRICK,
        ["great_hall"] = Tile.WOOD, ["hof"] = Tile.WOOD, ["trading_post"] = Tile.WOOD, ["fort_timber"] = Tile.WOOD, ["longship_harbor"] = Tile.WOOD, ["water_tower"] = Tile.WOOD,
        ["general_store"] = Tile.WOOD, ["corral"] = Tile.WOOD, ["town_square"] = Tile.WOOD, ["thermae"] = Tile.BRICK, ["railroad_depot"] = Tile.WOOD, ["tavern_square"] = Tile.WOOD, ["gallows_green"] = Tile.WOOD, ["thing_mound"] = Tile.GRASS,
        ["khan_ordu"] = Tile.PLASTER, ["ferry_camp"] = Tile.THATCH, ["standard_pole"] = Tile.WOOD, ["caravan"] = Tile.THATCH, ["ovoo"] = Tile.STONE,
        ["city_hall"] = Tile.CONCRETE, ["stadium"] = Tile.CONCRETE, ["steam_docks"] = Tile.BRICK, ["parliament"] = Tile.STONE, ["crystal_palace"] = Tile.CONCRETE, ["covered_market"] = Tile.BRICK,
        ["pyramid"] = Tile.SLAB, ["sphinx"] = Tile.SAND, ["temple_egypt"] = Tile.SLAB, ["palace_minoan"] = Tile.PLASTER, ["court_minoan"] = Tile.PLASTER, ["castle_japan"] = Tile.PLASTER,
        ["pagoda_tower"] = Tile.PLASTER, ["torii"] = Tile.WOOD, ["chinampas"] = Tile.GRASS, ["church_white"] = Tile.WOOD, ["fishing_harbor"] = Tile.WOOD, ["pirate_harbor"] = Tile.WOOD, ["canoe_landing"] = Tile.WOOD,
    };

    sealed class Ctx
    {
        public MeshBuilder Mb;
        public double X, Z, Y;
        public Rng Rng;
        public Era Era;
        public List<Collider> Col;

        /// <summary>Shallow copy with another base height (TS `{ ...c, y }`); shares the collider list.</summary>
        public Ctx With(double y) => new Ctx { Mb = Mb, X = X, Z = Z, Y = y, Rng = Rng, Era = Era, Col = Col };
    }

    static readonly int[] PM = { -1, 1 };

    static void Solid(Ctx c, double x, double z, double w, double d, double h, double rot = 0, string tag = null)
    {
        c.Col.Add(new Collider { X = x, Z = z, Hw = w / 2, Hd = d / 2, Rot = rot, H = h, Tag = tag });
    }

    /// <summary>A walkable floor or terrace top (absolute height).</summary>
    static void Platform(Ctx c, double x, double z, double w, double d, double top, double rot = 0, string tag = null)
    {
        c.Col.Add(new Collider { X = x, Z = z, Hw = w / 2, Hd = d / 2, Rot = rot, H = 0, Top = top, Tag = tag });
    }

    /// <summary>Rectangles whose union approximates a disk of radius 1 (overshooting by at most 7%).</summary>
    static readonly double[][] DISK_RECTS =
    {
        new[] { 1, 0.3 },
        new[] { 0.3, 1.0 },
        new[] { 0.72, 0.72 },
        new[] { 0.92, 0.55 },
        new[] { 0.55, 0.92 },
    };

    /// <summary>A round walkable floor.</summary>
    static void RoundPlatform(Ctx c, double x, double z, double r, double top)
    {
        foreach (var ab in DISK_RECTS) Platform(c, x, z, 2 * ab[0] * r, 2 * ab[1] * r, top);
    }

    /// <summary>A round solid.</summary>
    static void RoundSolid(Ctx c, double x, double z, double r, double h, string tag = null)
    {
        foreach (var ab in DISK_RECTS) Solid(c, x, z, 2 * ab[0] * r, 2 * ab[1] * r, h, 0, tag);
    }

    /// <summary>A column or post.</summary>
    static void Column(Ctx c, double x, double z, double r, double h)
    {
        c.Col.Add(new Collider { X = x, Z = z, Hw = r, Hd = r, Rot = 0, H = h });
    }

    /// <summary>
    /// A sloped mound or rampart from footprint w0 x d0 at y0 to w1 x d1 at y1, as stacked terraces
    /// that block at the slope and let you stand on top.
    /// </summary>
    static void Battered(Ctx c, double x, double z, double w0, double d0, double w1, double d1, double y0, double y1, int rings, double rot = 0)
    {
        for (int k = 0; k < rings; k++)
        {
            double f = (double)k / rings;
            Platform(c, x, z, w0 + (w1 - w0) * f, d0 + (d1 - d0) * f, y0 + ((y1 - y0) * (k + 0.5)) / rings, rot);
        }
        Platform(c, x, z, w1, d1, y1, rot);
    }

    /// <summary>Concentric steps around a podium; every step is walkable.</summary>
    static void Steps(Ctx c, double x, double z, double w, double d, int n, double stepH, int color, double rot = 0)
    {
        for (int i = 0; i < n; i++)
        {
            double s = 1 - (double)i / n;
            c.Mb.Box(x, c.Y + i * stepH, z, w * s + 0.5, stepH, d * s + 0.5, M.Shade(color, 1 - i * 0.02), rot);
            Platform(c, x, z, w * s + 0.5, d * s + 0.5, c.Y + (i + 1) * stepH, rot);
        }
    }

    /// <summary>
    /// A flight of steps with its foot at (x,z), climbing `rise` metres over `run` metres in the
    /// direction (dirX,dirZ). The steps stand on `y`; the top is at y + rise. Walkable as a ramp.
    /// </summary>
    static void Stair(Ctx c, double x, double y, double z, double width, double run, double rise, double dirX, double dirZ, int color)
    {
        double n = Math.Max(2, M.Round(rise / 0.4));
        double rot = Math.Atan2(dirZ, dirX);
        // the flight starts on the real ground at its foot, which may lie below the landmark's base
        // (a flight standing on a terrace starts on that terrace)
        double foot = y > c.Y + 0.01 ? y : Math.Min(c.Y, Macro.MeshHeight(x, z));
        double top = y + rise;
        for (int i = 0; i < n; i++)
        {
            double t = (i + 0.5) / n;
            double px = x + dirX * run * t;
            double pz = z + dirZ * run * t;
            double by = y > c.Y + 0.01 ? y : Math.Min(y, Macro.MeshHeight(px, pz) - 0.3);
            c.Mb.Box(px, by, pz, run / n + 0.05, foot + ((top - foot) * (i + 1)) / n - by, width, color, rot);
        }
        c.Col.Add(Collision.Ramp(x, z, foot, x + dirX * run, z + dirZ * run, top, width, "stair"));
    }

    static void Fence(Ctx c, double x, double z, double w, double d, int color, double postEvery = 3)
    {
        double[][] corners =
        {
            new[] { x - w / 2, z - d / 2 },
            new[] { x + w / 2, z - d / 2 },
            new[] { x + w / 2, z + d / 2 },
            new[] { x - w / 2, z + d / 2 },
        };
        for (int i = 0; i < 4; i++)
        {
            double[] a = corners[i];
            double[] b = corners[(i + 1) % 4];
            double len = M.Hypot(b[0] - a[0], b[1] - a[1]);
            double n = Math.Floor(len / postEvery);
            for (int k = 0; k <= n; k++)
            {
                double t = k / n;
                c.Mb.Box(a[0] + (b[0] - a[0]) * t, c.Y, a[1] + (b[1] - a[1]) * t, 0.25, 1.4, 0.25, color);
            }
            double rot = Math.Atan2(b[1] - a[1], b[0] - a[0]);
            c.Mb.Box((a[0] + b[0]) / 2, c.Y + 1.0, (a[1] + b[1]) / 2, len, 0.12, 0.1, color, rot);
            c.Mb.Box((a[0] + b[0]) / 2, c.Y + 0.5, (a[1] + b[1]) / 2, len, 0.12, 0.1, color, rot);
        }
    }

    /// <summary>gateSide: 0..3 = side with a gate, -1 = none.</summary>
    static void WallRect(Ctx c, double x, double z, double w, double d, double t, double h, int color, int gateSide = 2, double gateW = 6)
    {
        double[][] sides =
        {
            new[] { x, z - d / 2, w, t, 0 },
            new[] { x + w / 2, z, t, d, 0 },
            new[] { x, z + d / 2, w, t, 0 },
            new[] { x - w / 2, z, t, d, 0 },
        };
        for (int i = 0; i < sides.Length; i++)
        {
            double sx = sides[i][0], sz = sides[i][1], sw = sides[i][2], sd = sides[i][3];
            if (i == gateSide)
            {
                bool horiz = sw > sd;
                double len = horiz ? sw : sd;
                double seg = (len - gateW) / 2;
                if (horiz)
                {
                    c.Mb.Box(sx - (gateW + seg) / 2, c.Y - 1, sz, seg, h + 1, sd, color);
                    c.Mb.Box(sx + (gateW + seg) / 2, c.Y - 1, sz, seg, h + 1, sd, color);
                    Solid(c, sx - (gateW + seg) / 2, sz, seg, sd, h);
                    Solid(c, sx + (gateW + seg) / 2, sz, seg, sd, h);
                    c.Mb.Box(sx, c.Y + h, sz, gateW + 2, 1.6, sd + 1, M.Shade(color, 0.9));
                }
                else
                {
                    c.Mb.Box(sx, c.Y - 1, sz - (gateW + seg) / 2, sw, h + 1, seg, color);
                    c.Mb.Box(sx, c.Y - 1, sz + (gateW + seg) / 2, sw, h + 1, seg, color);
                    Solid(c, sx, sz - (gateW + seg) / 2, sw, seg, h);
                    Solid(c, sx, sz + (gateW + seg) / 2, sw, seg, h);
                    c.Mb.Box(sx, c.Y + h, sz, sw + 1, 1.6, gateW + 2, M.Shade(color, 0.9));
                }
            }
            else
            {
                c.Mb.Box(sx, c.Y - 1, sz, sw, h + 1, sd, color);
                Solid(c, sx, sz, sw, sd, h);
            }
        }
        // corner towers
        double[][] cornersT =
        {
            new[] { x - w / 2, z - d / 2 },
            new[] { x + w / 2, z - d / 2 },
            new[] { x + w / 2, z + d / 2 },
            new[] { x - w / 2, z + d / 2 },
        };
        foreach (var cc in cornersT)
        {
            double cx = cc[0], cz = cc[1];
            c.Mb.Box(cx, c.Y - 1, cz, t + 2.5, h + 3.5, t + 2.5, M.Shade(color, 0.95));
            Solid(c, cx, cz, t + 2.5, t + 2.5, h + 3.5);
        }
    }

    static void Crenellations(Ctx c, double x, double y, double z, double w, double d, int color)
    {
        double n = Math.Floor(w / 2.4);
        double m = Math.Floor(d / 2.4);
        for (int i = 0; i <= n; i++)
        {
            double px = x - w / 2 + (i * w) / n;
            c.Mb.Box(px, y, z - d / 2, 1.1, 1.0, 0.8, color);
            c.Mb.Box(px, y, z + d / 2, 1.1, 1.0, 0.8, color);
        }
        for (int i = 1; i < m; i++)
        {
            double pz = z - d / 2 + (i * d) / m;
            c.Mb.Box(x - w / 2, y, pz, 0.8, 1.0, 1.1, color);
            c.Mb.Box(x + w / 2, y, pz, 0.8, 1.0, 1.1, color);
        }
    }

    static void TempleClassical(Ctx c, double x, double z, double w, double d, int cols, int rows, double colH, int stone, int roof, double rot = 0)
    {
        var mb = c.Mb;
        Steps(c, x, z, w + 6, d + 6, 3, 0.5, M.Shade(stone, 0.95), rot);
        double y = c.Y + 1.5;
        double cs = Math.Cos(rot);
        double sn = Math.Sin(rot);
        for (int i = 0; i < cols; i++)
        {
            for (int j = 0; j < rows; j++)
            {
                bool edge = i == 0 || i == cols - 1 || j == 0 || j == rows - 1;
                if (!edge) continue;
                double lx = -w / 2 + ((double)i / (cols - 1)) * w;
                double lz = -d / 2 + ((double)j / (rows - 1)) * d;
                double px = x + lx * cs - lz * sn;
                double pz = z + lx * sn + lz * cs;
                mb.Cylinder(px, y, pz, 0.7, 0.6, colH, stone, 8);
                mb.Box(px, y + colH, pz, 1.6, 0.4, 1.6, stone, rot);
                Column(c, px, pz, 0.72, colH + 1.5);
            }
        }
        mb.Box(x, y, z, w * 0.72, colH, d * 0.78, M.Shade(stone, 0.93), rot);
        mb.Box(x, y + colH + 0.4, z, w + 2.4, 1.6, d + 2.4, stone, rot);
        mb.Prism(x, y + colH + 2, z, w + 3, (d + 3) * 0.22, d + 3, roof, rot);
        Solid(c, x, z, w * 0.72, d * 0.78, colH + 4, rot, "temple");
    }

    static void Ziggurat(Ctx c, double x, double z, double size, int tiers, int color)
    {
        double w = size;
        double y = c.Y;
        const double tierH = 7;
        for (int i = 0; i < tiers; i++)
        {
            c.Mb.Hip(x, y - (i == 0 ? 1 : 0), z, w, tierH + (i == 0 ? 1 : 0), w * 0.9, w * 0.82, w * 0.72, M.Shade(color, 1 - i * 0.04), 0);
            // sloped faces block, the terrace on top is walkable
            Battered(c, x, z, w, w * 0.9, w * 0.82, w * 0.72, y, y + tierH, 3);
            y += tierH;
            w *= 0.72;
        }
        c.Mb.Box(x, y, z, w * 0.7, 6, w * 0.6, M.Shade(color, 1.1));
        Solid(c, x, z, w * 0.7, w * 0.6, y - c.Y + 7, 0, "shrine");
        c.Mb.Box(x, y + 6, z, w * 0.8, 0.8, w * 0.7, 0x2a5a8a);
        // grand stair up the front
        Stair(c, x, c.Y, z + size * 0.45 + 12, 6, 12 + size * 0.45 - size * 0.36 * 0.5, tierH * tiers, 0, -1, M.Shade(color, 1.05));
    }

    static void SteppedPyramid(Ctx c, double x, double z, double size, int tiers, int color, int stairColor, bool twin = false)
    {
        double tierH = size / (tiers * 2.2);
        var sizes = new List<double>();
        for (int i = 0; i < tiers; i++)
        {
            double s = size * (1 - i / (tiers + 0.6));
            sizes.Add(s);
            c.Mb.Box(x, c.Y + i * tierH - (i == 0 ? 1 : 0), z, s, tierH + (i == 0 ? 1 : 0), s, M.Shade(color, 1 - i * 0.03));
            Platform(c, x, z, s, s, c.Y + (i + 1) * tierH);
        }
        double top = c.Y + tiers * tierH;
        double H = tiers * tierH;
        double topS = size * (1 - tiers / (tiers + 0.6));
        // the stair projects far enough from the base to clear every terrace edge on its way up
        double dTop = sizes[tiers - 1] / 2; // the stair arrives at the edge of the top terrace
        double outD = 0;
        for (int i = 0; i < tiers - 1; i++)
        {
            double k = (double)(i + 1) / tiers;
            outD = Math.Max(outD, (k * (size / 2 - dTop) - (size / 2 - sizes[i] / 2)) / (1 - k));
        }
        outD += 1;
        double run = size / 2 + outD - dTop;
        if (twin)
        {
            c.Mb.Box(x - topS * 0.25, top, z, topS * 0.4, 5, topS * 0.5, 0xc83a2a);
            c.Mb.Box(x + topS * 0.25, top, z, topS * 0.4, 5, topS * 0.5, 0x2a6ab0);
            Solid(c, x - topS * 0.25, z, topS * 0.4, topS * 0.5, H + 5, 0, "shrine");
            Solid(c, x + topS * 0.25, z, topS * 0.4, topS * 0.5, H + 5, 0, "shrine");
            Stair(c, x - topS * 0.25, c.Y, z + size / 2 + outD, Math.Max(2.4, topS * 0.3), run, H, 0, -1, stairColor);
            Stair(c, x + topS * 0.25, c.Y, z + size / 2 + outD, Math.Max(2.4, topS * 0.3), run, H, 0, -1, stairColor);
        }
        else
        {
            c.Mb.Box(x, top, z, topS * 0.6, 5, topS * 0.6, M.Shade(color, 1.1));
            c.Mb.Box(x, top + 5, z, topS * 0.5, 3, topS * 0.3, 0xd9cfb0);
            Solid(c, x, z, topS * 0.6, topS * 0.6, H + 8, 0, "shrine");
            Stair(c, x, c.Y, z + size / 2 + outD, 6, run, H, 0, -1, stairColor);
        }
    }

    static void PagodaTower(Ctx c, double x, double z, double w, int tiers, int wall, int roof)
    {
        const double fh = 4;
        for (int i = 0; i < tiers; i++)
        {
            double s = 1 - i * 0.1;
            c.Mb.Box(x, c.Y + i * fh, z, w * s, fh, w * s, wall);
            c.Mb.Hip(x, c.Y + (i + 1) * fh - 0.5, z, w * s + 4, 1.4, w * s + 4, w * s * 0.9, w * s * 0.9, roof);
        }
        c.Mb.Hip(x, c.Y + tiers * fh, z, w * (1 - tiers * 0.1) + 2, 4, w * (1 - tiers * 0.1) + 2, 0, 0, roof);
        c.Mb.Cylinder(x, c.Y + tiers * fh + 4, z, 0.3, 0.1, 4, 0xd9a52a, 6);
        Solid(c, x, z, w + 1, w + 1, tiers * fh, 0, "tower");
    }

    static readonly int[] LONGSHIP_SAIL = { 0xc83a2a, 0xe8e0d0 };
    static readonly int[] LONGSHIP_SHIELDS = { 0xc83a2a, 0xd9a52a, 0x2a6ab0 };
    static readonly double[] GALLEON_MASTS = { -6, 1, 8 };

    public static void BuildShip(MeshBuilder mb, double x, double y, double z, string kind, double rot, Rng rng)
    {
        int hull = M.Shade(0x6a4a30, rng.Range(0.85, 1.1));
        mb.Material(kind == "steamer" ? Tile.CONCRETE : kind == "reed" ? Tile.THATCH : Tile.WOOD, 0.6);
        switch (kind)
        {
            case "reed":
                mb.Hip(x, y - 0.4, z, 7, 1.0, 1.8, 5, 1.2, 0xc9b06a, rot);
                mb.Cylinder(x + Math.Cos(rot) * 3.4, y, z + Math.Sin(rot) * 3.4, 0.3, 0.05, 2.2, 0xc9b06a, 5);
                break;
            case "barque":
                mb.Hip(x, y - 0.4, z, 12, 1.4, 3, 9, 2.4, hull, rot);
                mb.Cylinder(x, y, z, 0.2, 0.15, 8, 0x5a4330, 5);
                mb.Prism(x, y + 3.5, z, 0.3, 4, 6, 0xf0e8d0, rot + Math.PI / 2);
                break;
            case "galley":
                mb.Hip(x, y - 0.5, z, 20, 1.6, 4, 17, 3.2, hull, rot);
                mb.Box(x, y + 1.1, z, 17, 0.5, 3.4, M.Shade(hull, 1.1), rot);
                mb.Cylinder(x, y + 1, z, 0.25, 0.18, 10, 0x5a4330, 5);
                mb.Box(x, y + 7, z, 9, 0.2, 0.2, 0x5a4330, rot);
                mb.Prism(x, y + 3.5, z, 0.3, 3.5, 8, 0xf0e8d0, rot + Math.PI / 2);
                for (int i = -3; i <= 3; i++)
                {
                    foreach (int s in PM)
                    {
                        double px = x + Math.Cos(rot) * i * 2.2 - Math.Sin(rot) * s * 2.4;
                        double pz = z + Math.Sin(rot) * i * 2.2 + Math.Cos(rot) * s * 2.4;
                        mb.Box(px, y + 0.9, pz, 0.15, 0.15, 2.2, 0x8a6a40, rot + s * 0.5);
                    }
                }
                break;
            case "longship":
                mb.Hip(x, y - 0.5, z, 18, 1.4, 3.2, 14, 2.6, hull, rot);
                mb.Box(x + Math.Cos(rot) * 8.5, y + 0.5, z + Math.Sin(rot) * 8.5, 0.8, 3.5, 0.8, hull, rot);
                mb.Cylinder(x, y + 0.9, z, 0.22, 0.16, 9, 0x5a4330, 5);
                mb.Box(x, y + 6, z, 0.3, 4.5, 8, rng.Pick(LONGSHIP_SAIL), rot);
                for (int i = -3; i <= 3; i++)
                {
                    foreach (int s in PM)
                    {
                        double px = x + Math.Cos(rot) * i * 2 - Math.Sin(rot) * s * 1.7;
                        double pz = z + Math.Sin(rot) * i * 2 + Math.Cos(rot) * s * 1.7;
                        mb.Cylinder(px, y + 0.9, pz, 0.5, 0.5, 0.12, rng.Pick(LONGSHIP_SHIELDS), 8);
                    }
                }
                break;
            case "junk":
                mb.Hip(x, y - 0.5, z, 14, 1.8, 4, 12, 3.4, hull, rot);
                mb.Box(x - Math.Cos(rot) * 3, y + 1.3, z - Math.Sin(rot) * 3, 5, 1.6, 3.6, M.Shade(hull, 1.1), rot);
                mb.Cylinder(x, y + 1.2, z, 0.2, 0.15, 10, 0x5a4330, 5);
                mb.Box(x, y + 4, z, 0.3, 6, 6, 0xc9b890, rot);
                break;
            case "galleon":
                mb.Hip(x, y - 0.8, z, 26, 2.6, 7, 22, 5.5, hull, rot);
                mb.Box(x - Math.Cos(rot) * 8, y + 1.8, z - Math.Sin(rot) * 8, 8, 3, 6, M.Shade(hull, 1.1), rot);
                mb.Box(x + Math.Cos(rot) * 6, y + 1.8, z + Math.Sin(rot) * 6, 6, 1.6, 5.5, M.Shade(hull, 1.05), rot);
                foreach (double m in GALLEON_MASTS)
                {
                    double mh = m == 1 ? 20 : 15;
                    mb.Cylinder(x + Math.Cos(rot) * m, y + 1.8, z + Math.Sin(rot) * m, 0.3, 0.2, mh, 0x5a4330, 5);
                    mb.Box(x + Math.Cos(rot) * m, y + 1.8 + mh * 0.45, z + Math.Sin(rot) * m, 0.4, mh * 0.35, 7, 0xeee6d2, rot);
                    mb.Box(x + Math.Cos(rot) * m, y + 1.8 + mh * 0.75, z + Math.Sin(rot) * m, 0.4, mh * 0.22, 5, 0xeee6d2, rot);
                }
                mb.Box(x - Math.Cos(rot) * 12.5, y + 10, z - Math.Sin(rot) * 12.5, 0.2, 2, 3, 0x111111, rot);
                break;
            case "steamer":
                mb.Hip(x, y - 1, z, 34, 3.4, 8, 32, 7, 0x2a2a2a, rot);
                mb.Box(x, y + 2.3, z, 20, 2.4, 6.5, 0xe8e0d0, rot);
                mb.Cylinder(x + Math.Cos(rot) * 3, y + 4.7, z + Math.Sin(rot) * 3, 1.3, 1.2, 7, 0xb03020, 8);
                mb.Cylinder(x + Math.Cos(rot) * 3, y + 11.5, z + Math.Sin(rot) * 3, 1.4, 1.4, 0.8, 0x111111, 8);
                mb.Cylinder(x - Math.Cos(rot) * 12, y + 2.3, z - Math.Sin(rot) * 12, 0.2, 0.15, 10, 0x4a4a4a, 5);
                break;
            case "canoe":
                mb.Hip(x, y - 0.3, z, 6, 0.7, 1.2, 4.5, 0.8, hull, rot);
                break;
            case "none":
                break;
        }
    }

    static readonly string[] QUAY_CARGO = { "crate", "barrel", "amphora" };

    static void Quay(Ctx c, string shipKind, int stone, int n)
    {
        var mb = c.Mb;
        double x = c.X, z = c.Z;
        var rng = c.Rng;
        // two piers reaching into the water
        foreach (double px in new[] { x - 30, x + 30 })
        {
            mb.Box(px, c.Y - 1, z + 30, 8, 2.2, 70, stone);
            Platform(c, px, z + 30, 8, 70, c.Y + 1.2, 0, "pier");
            for (int i = 0; i < 6; i++) mb.Cylinder(px + 3.6, c.Y + 1.2, z + i * 12, 0.3, 0.3, 1.0, 0x3a3a3a, 5);
        }
        mb.Box(x, c.Y - 1, z - 10, 80, 2.2, 14, stone);
        Platform(c, x, z - 10, 80, 14, c.Y + 1.2, 0, "quay");
        // steps up from the street side
        foreach (double sx in new[] { x - 30, x, x + 30 }) Stair(c, sx, c.Y - 0.3, z - 20, 6, 3, 1.5, 0, 1, M.Shade(stone, 0.95));
        if (shipKind != "none")
        {
            for (int i = 0; i < n; i++)
            {
                double sx = x + (i - (n - 1) / 2.0) * 24 + rng.Range(-3, 3);
                double sz = z + 45 + rng.Range(-5, 12);
                double srot = Math.PI / 2 + rng.Range(-0.2, 0.2);
                BuildShip(mb, sx, -0.8, sz, shipKind, srot, rng);
            }
        }
        for (int i = 0; i < 10; i++)
        {
            double pz = z - 10 + rng.Range(-4, 4);
            string kind = rng.Pick(QUAY_CARGO);
            double prot = rng.Range(0, 3);
            Props.BuildProp(mb, x - 36 + i * 8, c.Y + 1.2, pz, kind, rng, prot);
        }
    }

    static readonly Dictionary<string, Action<Ctx>> GENERATORS = new()
    {
        // ---------- citadels ----------
        ["ziggurat"] = c =>
        {
            Ziggurat(c, c.X, c.Z, 110, 3, 0xc9a56c);
            WallRect(c, c.X, c.Z, 200, 190, 3, 6, 0xb8945c, 2, 12);
        },
        ["pyramid"] = c =>
        {
            c.Mb.Hip(c.X, c.Y - 1, c.Z, 150, 96, 150, 0, 0, 0xf2e6c8);
            Solid(c, c.X, c.Z, 150, 150, 96, 0, "citadel");
            c.Mb.Hip(c.X + 100, c.Y - 1, c.Z + 60, 40, 26, 40, 0, 0, 0xe8dcb8);
            Solid(c, c.X + 100, c.Z + 60, 40, 40, 26);
            c.Mb.Hip(c.X - 100, c.Y - 1, c.Z + 60, 28, 18, 28, 0, 0, 0xe8dcb8);
            Solid(c, c.X - 100, c.Z + 60, 28, 28, 18);
            c.Mb.Box(c.X, c.Y, c.Z + 95, 30, 5, 14, 0xe0d0a8);
            Solid(c, c.X, c.Z + 95, 30, 14, 5);
        },
        ["palace_minoan"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int stone = 0xf1e7d2;
            const int red = 0xb03a2a;
            mb.Box(x, c.Y - 1, z, 120, 1.6, 100, 0xd8ccb0);
            Platform(c, x, z, 120, 100, c.Y + 0.6);
            double[][] wings =
            {
                new double[] { -40, -30, 36, 36, 3 },
                new double[] { 40, -30, 36, 30, 2 },
                new double[] { -40, 30, 36, 30, 2 },
                new double[] { 40, 30, 36, 36, 3 },
                new double[] { 0, -40, 40, 16, 2 },
                new double[] { 0, 40, 40, 16, 1 },
            };
            foreach (var wg in wings)
            {
                double ox = wg[0], oz = wg[1], w = wg[2], d = wg[3], floors = wg[4];
                mb.Box(x + ox, c.Y, z + oz, w, floors * 3.4, d, stone);
                mb.Box(x + ox, c.Y + floors * 3.4, z + oz, w + 0.6, 0.6, d + 0.6, 0xd0c4a8);
                Solid(c, x + ox, z + oz, w, d, floors * 3.4, 0, "palace");
                for (int f = 0; f < floors; f++) mb.Box(x + ox, c.Y + f * 3.4 + 0.4, z + oz, w + 0.3, 0.5, d + 0.3, red);
            }
            // central court with inverted red columns
            for (int i = -2; i <= 2; i++)
            {
                mb.Cylinder(x + i * 8, c.Y + 0.6, z - 14, 0.5, 0.8, 4, red, 8);
                mb.Cylinder(x + i * 8, c.Y + 0.6, z + 14, 0.5, 0.8, 4, red, 8);
                Column(c, x + i * 8, z - 14, 0.8, 4);
                Column(c, x + i * 8, z + 14, 0.8, 4);
            }
            // horns of consecration
            foreach (double ox in new double[] { -55, 55 })
            {
                mb.Box(x + ox, c.Y + 1, z - 48, 8, 2, 2, stone);
                mb.Hip(x + ox - 3, c.Y + 3, z - 48, 2, 3, 2, 0.5, 0.5, stone);
                mb.Hip(x + ox + 3, c.Y + 3, z - 48, 2, 3, 2, 0.5, 0.5, stone);
            }
        },
        ["citadel_mycenae"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int stone = 0x9a8f78;
            WallRect(c, x, z, 170, 140, 7, 9, stone, 2, 7);
            // lion gate relief
            mb.Box(x, c.Y + 9, z + 70, 11, 5, 2.5, M.Shade(stone, 1.1));
            mb.Hip(x, c.Y + 14, z + 70, 11, 3, 2.5, 3, 2, 0xb8a888);
            // megaron
            mb.Box(x, c.Y, z - 10, 40, 1.5, 30, 0xb8a888);
            Platform(c, x, z - 10, 40, 30, c.Y + 1.5);
            Stair(c, x, c.Y, z + 8, 8, 3, 1.5, 0, -1, 0xb0a080);
            mb.Box(x, c.Y + 1.5, z - 15, 30, 7, 20, 0xd3c4a0);
            Solid(c, x, z - 15, 30, 20, 8.5, 0, "palace");
            mb.Prism(x, c.Y + 8.5, z - 15, 32, 4, 22, 0x8a6d4a);
            for (int i = -1; i <= 1; i++)
            {
                mb.Cylinder(x + i * 7, c.Y + 1.5, z - 2, 0.7, 0.6, 7, 0xb03a2a, 8);
                Column(c, x + i * 7, z - 2, 0.7, 8.5);
            }
            // houses inside
            for (int i = 0; i < 6; i++)
            {
                double hx = x - 60 + i * 24;
                mb.Box(hx, c.Y, z + 35, 12, 4, 10, 0xcdbf9c);
                Solid(c, hx, z + 35, 12, 10, 4);
            }
        },
        ["palace_assyria"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int brick = 0xc9a56c;
            mb.Box(x, c.Y - 1, z, 170, 6, 140, M.Shade(brick, 0.9));
            Platform(c, x, z, 170, 140, c.Y + 5);
            Solid(c, x, z - 25, 150, 80, 24, 0, "palace");
            mb.Box(x, c.Y + 5, z - 25, 150, 14, 80, brick);
            Crenellations(c, x, c.Y + 19, z - 25, 150, 80, M.Shade(brick, 0.9));
            mb.Box(x, c.Y + 4.9, z + 45, 150, 0.15, 40, M.Shade(brick, 1.05));
            // lamassu pairs at the gate
            foreach (int s in PM)
            {
                double lx = x + s * 12;
                mb.Box(lx, c.Y + 5, z + 16, 4, 6, 9, 0xe8dcc0);
                mb.Box(lx, c.Y + 11, z + 20.5, 3, 3, 3, 0xe8dcc0);
                mb.Prism(lx + s * 1.5, c.Y + 9, z + 14, 7, 2.5, 1, 0xd8ccb0, Math.PI / 2);
                Solid(c, lx, z + 16, 4, 9, 11);
            }
            Stair(c, x, c.Y - 1, z + 80, 20, 10, 6, 0, -1, M.Shade(brick, 1.05));
            for (int i = 0; i < 5; i++) mb.Cylinder(x - 40 + i * 20, c.Y + 19, z - 55, 0.5, 0.4, 6, 0xd9a52a, 6);
        },
        ["parthenon"] = c =>
        {
            TempleClassical(c, c.X, c.Z, 60, 28, 17, 8, 10, 0xf4efe4, 0xd9cfbc);
            TempleClassical(c, c.X - 70, c.Z + 40, 22, 12, 6, 4, 6, 0xf1ebdc, 0xb5533b);
            c.Mb.Box(c.X + 70, c.Y, c.Z + 40, 1.6, 12, 1.6, 0xd9cfbc);
            Column(c, c.X + 70, c.Z + 40, 0.8, 16);
            c.Mb.Box(c.X + 70, c.Y + 12, c.Z + 40, 1.2, 4, 1.2, 0xb8a24a);
        },
        ["palace_maurya"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int stone = 0xf2e8d0;
            mb.Box(x, c.Y - 1, z, 120, 2.5, 100, 0xd8c8a0);
            Platform(c, x, z, 120, 100, c.Y + 1.5);
            Stair(c, x, c.Y - 1, z + 54, 20, 4, 2.5, 0, -1, 0xd0c098);
            for (int i = 0; i < 8; i++)
            {
                for (int j = 0; j < 7; j++)
                {
                    mb.Cylinder(x - 42 + i * 12, c.Y + 1.5, z - 36 + j * 12, 0.9, 0.8, 10, stone, 8);
                    Column(c, x - 42 + i * 12, z - 36 + j * 12, 0.9, 12);
                }
            }
            mb.Box(x, c.Y + 11.5, z, 100, 2.5, 84, 0x7a4a2c);
            mb.Hip(x, c.Y + 14, z, 100, 6, 84, 70, 54, 0x8a5a3a);
            mb.Box(x, c.Y + 20, z, 30, 5, 24, stone);
            mb.Hip(x, c.Y + 25, z, 32, 5, 26, 0, 0, 0x7a4a2c);
            // Ashoka pillar
            mb.Cylinder(x + 70, c.Y, z + 50, 1.2, 1.0, 14, 0xe9dfc8, 10);
            Column(c, x + 70, z + 50, 1.2, 18);
            mb.Dome(x + 70, c.Y + 14, z + 50, 1.6, 0xd9c08a, 8, 2);
            mb.Box(x + 70, c.Y + 15.5, z + 50, 2.6, 2.4, 2.6, 0xd9c08a);
        },
        ["capitol_rome"] = c =>
        {
            TempleClassical(c, c.X, c.Z, 48, 30, 8, 6, 12, 0xf4efe4, 0xb04f36);
            TempleClassical(c, c.X - 75, c.Z + 30, 20, 14, 6, 4, 7, 0xf1ebdc, 0xb04f36);
            TempleClassical(c, c.X + 75, c.Z + 30, 20, 14, 6, 4, 7, 0xf1ebdc, 0xb04f36);
            // equestrian statue
            c.Mb.Box(c.X, c.Y, c.Z + 50, 4, 3, 7, 0xd8d0c0);
            c.Mb.Box(c.X, c.Y + 3, c.Z + 50, 1.6, 2, 5, 0x8a7a5a);
            c.Mb.Box(c.X, c.Y + 5, c.Z + 50, 1.2, 2.4, 1.2, 0x8a7a5a);
            Solid(c, c.X, c.Z + 50, 4, 7, 7);
        },
        ["pyramid_maya"] = c =>
        {
            SteppedPyramid(c, c.X, c.Z, 90, 9, 0xd8ccb0, 0xc8b898);
            SteppedPyramid(c, c.X + 85, c.Z - 50, 40, 5, 0xd0c4a8, 0xc8b898);
            SteppedPyramid(c, c.X - 85, c.Z - 50, 34, 4, 0xd0c4a8, 0xc8b898);
        },
        ["great_hall"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            mb.Box(x, c.Y - 1, z, 44, 6, 14, 0x5c4630);
            Solid(c, x, z, 44, 14, 12, 0, "hall");
            mb.Prism(x, c.Y + 5, z, 48, 8, 20, 0x8a7a4a);
            foreach (int s in PM)
            {
                mb.Box(x + s * 24.5, c.Y + 12, z, 1, 2.5, 0.4, 0x3a2a1a, 0.5);
                mb.Box(x + s * 24.5, c.Y + 12, z, 1, 2.5, 0.4, 0x3a2a1a, -0.5);
            }
            Fence(c, x, z, 90, 60, 0x5a4a3a, 2.5);
            for (int i = 0; i < 5; i++) Props.BuildProp(mb, x - 30 + i * 15, c.Y, z + 22, "runestone", c.Rng, c.Rng.Range(0, 3));
            Props.BuildProp(mb, x, c.Y, z - 20, "campfire", c.Rng);
        },
        ["angkor"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int stone = 0x9a9078;
            // moat
            mb.GroundQuad(x - 115, z - 115, x + 115, z - 115, x + 115, z + 115, x - 115, z + 115, c.Y + 0.05, c.Era.Water);
            mb.Box(x, c.Y - 1, z, 170, 3, 170, 0xa89e86);
            mb.Box(x, c.Y + 2, z, 130, 4, 130, stone);
            mb.Box(x, c.Y + 6, z, 80, 6, 80, M.Shade(stone, 1.05));
            Platform(c, x, z, 170, 170, c.Y + 2);
            Platform(c, x, z, 130, 130, c.Y + 6);
            Platform(c, x, z, 80, 80, c.Y + 12);
            // stairs up each terrace on the causeway axis
            Stair(c, x, c.Y + 2, z + 70, 10, 5, 4, 0, -1, M.Shade(stone, 1.02));
            Stair(c, x, c.Y + 6, z + 46.5, 8, 6.5, 6, 0, -1, M.Shade(stone, 1.06));
            void Tower(double tx, double tz, double h, double bse)
            {
                const int n = 5;
                for (int i = 0; i < n; i++)
                {
                    double s = bse * (1 - (double)i / n);
                    mb.Box(tx, c.Y + 12 + (i * h) / n, tz, s, h / n, s, M.Shade(stone, 1 + i * 0.03));
                }
                mb.Hip(tx, c.Y + 12 + h, tz, bse * 0.3, 4, bse * 0.3, 0, 0, M.Shade(stone, 1.1));
                Solid(c, tx, tz, bse, bse, 12 + h + 4, 0, "temple");
            }
            Tower(x, z, 30, 16);
            foreach (var o in new[] { new double[] { -28, -28 }, new double[] { 28, -28 }, new double[] { 28, 28 }, new double[] { -28, 28 } })
                Tower(x + o[0], z + o[1], 22, 12);
            // causeway over the moat
            mb.Box(x, c.Y - 6, z + 117, 12, 8, 66, 0xa89e86);
            Platform(c, x, z + 117, 12, 66, c.Y + 2);
            Stair(c, x, c.Y, z + 160, 10, 10, 2, 0, -1, 0xa89e86);
            for (int i = 0; i < 6; i++)
            {
                foreach (int s in PM) mb.Cylinder(x + s * 6, c.Y + 2, z + 95 + i * 10, 0.4, 0.3, 1.2, stone, 6);
            }
            // naga heads
            foreach (int s in PM) mb.Hip(x + s * 7, c.Y + 2.7, z + 148, 3, 3, 2, 1, 1, M.Shade(stone, 1.1));
        },
        ["khan_ordu"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            var rng = c.Rng;
            mb.Cylinder(x, c.Y - 0.5, z, 16, 16, 4.5, 0xf9f6ee, 16);
            mb.Cylinder(x, c.Y + 4, z, 16.8, 0, 6, 0xd9a52a, 16);
            Solid(c, x, z, 30, 30, 10, 0, "hall");
            for (int i = 0; i < 12; i++)
            {
                double a = (i / 12.0) * Math.PI * 2;
                double gx = x + Math.Cos(a) * 45;
                double gz = z + Math.Sin(a) * 45;
                mb.Cylinder(gx, c.Y - 0.3, gz, 4.5, 4.5, 2.2, 0xf0ece0, 10);
                mb.Cylinder(gx, c.Y + 1.9, gz, 4.8, 0, 2.2, 0xe4ded0, 10);
                Solid(c, gx, gz, 9, 9, 4);
            }
            for (int i = 0; i < 9; i++)
            {
                double a = (i / 9.0) * Math.PI * 2;
                mb.Cylinder(x + Math.Cos(a) * 22, c.Y, z + Math.Sin(a) * 22, 0.15, 0.1, 7, 0x3a2a1a, 5);
                mb.Cylinder(x + Math.Cos(a) * 22, c.Y + 6.5, z + Math.Sin(a) * 22, 0.7, 0.1, 1.2, 0xe8e0d0, 5);
            }
            Props.BuildProp(mb, x + 30, c.Y, z - 20, "campfire", rng);
            Props.BuildProp(mb, x - 32, c.Y, z + 18, "campfire", rng);
        },
        ["templo_mayor"] = c =>
        {
            SteppedPyramid(c, c.X, c.Z, 90, 6, 0xf1ebdc, 0xe0d6bc, true);
            WallRect(c, c.X, c.Z, 210, 200, 3, 4, 0xe6dcc4, 2, 16);
            foreach (double ox in new double[] { -70, 70 })
            {
                SteppedPyramid(c, c.X + ox, c.Z + 40, 30, 4, 0xe9e0cc, 0xd8ccb0);
            }
            c.Mb.Cylinder(c.X - 60, c.Y, c.Z - 60, 10, 10, 6, 0xd9cfb5, 12);
            c.Mb.Cylinder(c.X - 60, c.Y + 6, c.Z - 60, 10.5, 0, 4, 0xc8b898, 12);
            Solid(c, c.X - 60, c.Z - 60, 20, 20, 10);
        },
        ["castle_japan"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int stone = 0x6f6f68;
            mb.Hip(x, c.Y - 1, z, 120, 14, 110, 90, 80, stone);
            Battered(c, x, z, 120, 110, 90, 80, c.Y - 1, c.Y + 13, 6);
            Solid(c, x, z, 40, 34, 45, 0, "castle");
            WallRect(c.With(c.Y + 13), x, z, 86, 76, 1.2, 2.4, 0xf0e8d4, 2, 12);
            const int tiers = 5;
            for (int i = 0; i < tiers; i++)
            {
                double s = 1 - i * 0.14;
                double w = 40 * s;
                double d = 34 * s;
                double yy = c.Y + 13 + i * 5;
                mb.Box(x, yy, z, w, 5, d, 0xf3ede0);
                mb.Hip(x, yy + 4.6, z, w + 5, 1.8, d + 5, w * 0.92, d * 0.92, 0x2e2e32);
                mb.Box(x, yy + 1.8, z, w + 0.2, 1.2, d + 0.2, 0x2a2a2e);
            }
            mb.Hip(x, c.Y + 13 + tiers * 5, z, 40 * (1 - tiers * 0.14) + 3, 6, 34 * (1 - tiers * 0.14) + 3, 0, 0, 0x2e2e32);
            foreach (int s in PM) mb.Box(x + s * 2, c.Y + 13 + tiers * 5 + 6, z, 1.2, 1.8, 0.4, 0xd9a52a, 0.6 * s);
            Stair(c, x, c.Y - 1, z + 70, 10, 30, 14, 0, -1, M.Shade(stone, 1.1));
        },
        ["fort_stone"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            var rng = c.Rng;
            const int stone = 0x8a8a80;
            WallRect(c, x, z, 110, 90, 6, 8, stone, 2, 8);
            foreach (var o in new[] { new double[] { -55, -45 }, new double[] { 55, -45 }, new double[] { 55, 45 }, new double[] { -55, 45 } })
            {
                double cx = o[0], cz = o[1];
                mb.Hip(x + cx, c.Y - 1, z + cz, 22, 9, 22, 16, 16, stone, Math.PI / 4);
                Solid(c, x + cx, z + cz, 20, 20, 9, Math.PI / 4);
            }
            mb.Box(x, c.Y, z - 10, 30, 7, 16, 0xe9dfc8);
            mb.Prism(x, c.Y + 7, z - 10, 32, 4, 18, 0x6a4a3a);
            Solid(c, x, z - 10, 30, 16, 11, 0, "hall");
            for (int i = 0; i < 6; i++) Props.BuildProp(mb, x - 40 + i * 16, c.Y, z - 36, "cannon", rng, Math.PI / 2);
            mb.Cylinder(x, c.Y, z + 20, 0.2, 0.15, 14, 0x5a4a3a, 5);
            mb.Box(x + 2, c.Y + 12, z + 20, 4, 2.5, 0.2, 0x111111);
        },
        ["fort_timber"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int wood = 0x7a5a3a;
            for (int i = 0; i < 4; i++)
            {
                bool horiz = i % 2 == 0;
                double len = horiz ? 90 : 70;
                double n = Math.Floor(len / 1.2);
                for (int k = 0; k < n; k++)
                {
                    double t = -len / 2 + k * 1.2;
                    double px = horiz ? x + t : x + (i == 1 ? 45 : -45);
                    double pz = horiz ? z + (i == 0 ? -35 : 35) : z + t;
                    if (i == 2 && Math.Abs(t) < 4) continue;
                    mb.Cylinder(px, c.Y - 0.5, pz, 0.6, 0.45, 5.5 + (k % 3) * 0.3, wood, 5);
                }
                if (horiz) Solid(c, x, z + (i == 0 ? -35 : 35), 90, 1.4, 5.5);
                else Solid(c, x + (i == 1 ? 45 : -45), z, 1.4, 70, 5.5);
            }
            mb.Box(x + 35, c.Y + 5, z - 28, 8, 4, 8, 0x8a6a4a);
            foreach (var o in new[] { new[] { 31.5, -31.5 }, new[] { 38.5, -31.5 }, new[] { 31.5, -24.5 }, new[] { 38.5, -24.5 } })
                mb.Box(x + o[0], c.Y, z + o[1], 0.5, 5, 0.5, wood);
            mb.Hip(x + 35, c.Y + 9, z - 28, 9, 3, 9, 0, 0, 0x5a4a3a);
            Solid(c, x + 35, z - 28, 8, 8, 12);
            mb.Box(x, c.Y, z - 5, 24, 4, 12, 0x9a7a52);
            mb.Prism(x, c.Y + 4, z - 5, 26, 3, 14, 0x5a4a3a);
            Solid(c, x, z - 5, 24, 12, 7, 0, "hall");
            mb.Cylinder(x - 20, c.Y, z + 10, 0.2, 0.15, 12, 0x5a4a3a, 5);
            mb.Box(x - 18, c.Y + 10, z + 10, 4, 2.5, 0.2, 0x2a3a8a);
        },
        ["parliament"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int stone = 0xc9b89a;
            mb.Box(x, c.Y - 1, z, 130, 22, 40, stone);
            Solid(c, x, z, 130, 40, 22, 0, "civic");
            for (int f = 0; f < 5; f++)
            {
                mb.Box(x, c.Y + 2 + f * 4, z, 130.3, 1.4, 40.3, 0x2a2a30);
            }
            for (int i = 0; i < 14; i++)
            {
                mb.Box(x - 60 + i * 9.2, c.Y + 21, z - 20, 1.6, 6, 1.6, stone);
                mb.Hip(x - 60 + i * 9.2, c.Y + 27, z - 20, 2, 2.4, 2, 0, 0, M.Shade(stone, 0.9));
                mb.Box(x - 60 + i * 9.2, c.Y + 21, z + 20, 1.6, 6, 1.6, stone);
                mb.Hip(x - 60 + i * 9.2, c.Y + 27, z + 20, 2, 2.4, 2, 0, 0, M.Shade(stone, 0.9));
            }
            mb.Prism(x, c.Y + 21, z, 128, 6, 36, 0x3a3a42);
            // clock tower
            mb.Box(x + 72, c.Y - 1, z, 14, 60, 14, stone);
            Solid(c, x + 72, z, 14, 14, 60);
            mb.Box(x + 72, c.Y + 52, z, 15, 5, 15, 0xe8e0d0);
            mb.Box(x + 72, c.Y + 54, z - 7.6, 6, 0.6, 0.3, 0x2a2a2a);
            mb.Hip(x + 72, c.Y + 59, z, 15, 12, 15, 0, 0, 0x3a3a42);
            mb.Box(x - 72, c.Y - 1, z, 18, 34, 18, stone);
            Solid(c, x - 72, z, 18, 18, 34);
            mb.Hip(x - 72, c.Y + 33, z, 19, 10, 19, 0, 0, 0x3a3a42);
        },
        ["city_hall"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int stone = 0xd9d2c2;
            mb.Box(x, c.Y - 1, z, 90, 18, 70, stone);
            Solid(c, x, z, 90, 70, 18, 0, "civic");
            mb.Box(x, c.Y - 1, z + 37.5, 86, 3, 6, M.Shade(stone, 0.95));
            Platform(c, x, z + 37.5, 86, 6, c.Y + 2);
            for (int i = 0; i < 10; i++)
            {
                mb.Cylinder(x - 36 + i * 8, c.Y + 2, z + 37, 1, 0.9, 14, M.Shade(stone, 1.05), 8);
                Column(c, x - 36 + i * 8, z + 37, 1, 16);
            }
            mb.Box(x, c.Y + 16, z + 37.5, 86, 2.5, 6, stone);
            mb.Box(x, c.Y + 17, z, 44, 40, 40, 0xcfc8b8);
            mb.Box(x, c.Y + 57, z, 30, 26, 28, 0xcac3b3);
            mb.Box(x, c.Y + 83, z, 18, 20, 18, 0xc4bdad);
            for (int f = 0; f < 25; f++)
            {
                double w = f < 10 ? 44 : f < 16 ? 30 : 18;
                double d = f < 10 ? 40 : f < 16 ? 28 : 18;
                mb.Box(x, c.Y + 18 + f * 3.4, z, w * 0.75, 1.2, d + 0.1, 0x1e2228);
                mb.Box(x, c.Y + 18 + f * 3.4, z, w + 0.1, 1.2, d * 0.75, 0x1e2228);
            }
            mb.Hip(x, c.Y + 103, z, 18, 10, 18, 2, 2, 0x8a8a92);
            mb.Cylinder(x, c.Y + 113, z, 0.6, 0.1, 18, 0x9a9aa0, 6);
            Stair(c, x, c.Y - 1, z + 48, 40, 7.5, 3, 0, -1, M.Shade(stone, 0.95));
            mb.Cylinder(x - 30, c.Y, z + 54, 0.2, 0.15, 16, 0x8a8a92, 5);
            mb.Box(x - 28, c.Y + 12, z + 54, 4, 2.5, 0.2, 0x3a5a9a);
            Column(c, x - 30, z + 54, 0.3, 16);
        },

        // ---------- harbors ----------
        ["quay"] = c => Quay(c, c.Era.Ships, 0xb8a888, 3),
        ["quay_roman"] = c =>
        {
            Quay(c, "galley", 0xc9c0b0, 4);
            c.Mb.Cylinder(c.X + 60, c.Y, c.Z - 25, 4, 3, 24, 0xe8e0d0, 10);
            c.Mb.Cylinder(c.X + 60, c.Y + 24, c.Z - 25, 2, 0.5, 5, 0xffa030, 8);
            Solid(c, c.X + 60, c.Z - 25, 8, 8, 24);
        },
        ["longship_harbor"] = c =>
        {
            Quay(c, "longship", 0x6a5a40, 5);
            c.Mb.Box(c.X - 50, c.Y, c.Z - 25, 14, 4, 24, 0x5c4630);
            c.Mb.Prism(c.X - 50, c.Y + 4, c.Z - 25, 16, 4, 26, 0x7a6a3a);
            Solid(c, c.X - 50, c.Z - 25, 14, 24, 8);
        },
        ["pirate_harbor"] = c =>
        {
            Quay(c, "galleon", 0x8a7a60, 3);
            c.Mb.Box(c.X + 50, c.Y, c.Z - 28, 18, 6, 12, 0xd9c7a0);
            c.Mb.Prism(c.X + 50, c.Y + 6, c.Z - 28, 20, 4, 14, 0x5a4a3a);
            Solid(c, c.X + 50, c.Z - 28, 18, 12, 10, 0, "tavern");
            c.Mb.Box(c.X + 50, c.Y + 4, c.Z - 21.8, 4, 1.2, 0.2, 0x111111);
        },
        ["fishing_harbor"] = c => Quay(c, "junk", 0x7a7a70, 5),
        ["steam_docks"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            Quay(c, "steamer", 0x6a6a68, 2);
            foreach (double ox in new double[] { -55, 55 })
            {
                mb.Box(x + ox, c.Y, z - 40, 30, 10, 18, 0x7a5a4a);
                mb.Prism(x + ox, c.Y + 10, z - 40, 32, 3, 20, 0x4a4a52);
                Solid(c, x + ox, z - 40, 30, 18, 13, 0, "warehouse");
            }
            foreach (double ox in new double[] { -20, 20 })
            {
                mb.Material(Tile.CONCRETE, 0.5);
                mb.Box(x + ox, c.Y, z - 8, 2.5, 22, 2.5, 0x3a3a3a);
                mb.Box(x + ox + 8, c.Y + 20, z - 8, 20, 1.2, 1.2, 0x3a3a3a);
                Solid(c, x + ox, z - 8, 2.5, 2.5, 22);
            }
            // gasometer
            mb.Material(Tile.CONCRETE, 0.4);
            mb.Cylinder(x - 90, c.Y, z - 60, 14, 14, 16, 0x5a5a58, 16);
            for (int i = 0; i < 12; i++)
            {
                double a = (i / 12.0) * Math.PI * 2;
                mb.Box(x - 90 + Math.Cos(a) * 15, c.Y, z - 60 + Math.Sin(a) * 15, 0.6, 24, 0.6, 0x3a3a3a, a);
            }
            mb.RingWall(x - 90, c.Y + 23.4, z - 60, 15, 0.5, 0.6, 0x3a3a3a, 12);
            Solid(c, x - 90, z - 60, 30, 30, 24, 0, "gasometer");
        },
        ["railroad_depot"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            // tracks along the shore
            mb.Box(x, c.Y + 0.05, z - 30, 160, 0.3, 1.6, 0x4a4a4a);
            for (int i = 0; i < 80; i++) mb.Box(x - 80 + i * 2, c.Y + 0.1, z - 30, 0.4, 0.2, 2.6, 0x5a4a3a);
            foreach (double s in new[] { -0.7, 0.7 }) mb.Box(x, c.Y + 0.3, z - 30 + s, 160, 0.15, 0.15, 0x8a8a8a);
            // locomotive
            mb.Cylinder(x + 10, c.Y + 1.2, z - 30, 1.2, 1.2, 8, 0x1a1a1a, 10, 0);
            mb.Box(x + 10, c.Y + 1.2, z - 30, 8, 2.4, 2.4, 0x1a1a1a);
            mb.Box(x + 15, c.Y + 1, z - 30, 3.2, 3.6, 2.8, 0x2a2a2a);
            mb.Cylinder(x + 7, c.Y + 3.4, z - 30, 0.6, 1.0, 2.4, 0x1a1a1a, 8);
            for (int i = 0; i < 3; i++) mb.Box(x + 24 + i * 9, c.Y + 1.2, z - 30, 8, 3, 2.6, i == 1 ? 0x6a3a2a : 0x4a3a2a);
            Solid(c, x + 25, z - 30, 60, 3, 4);
            // depot + water tower
            mb.Box(x, c.Y, z - 12, 24, 4.5, 10, 0xb08a5a);
            mb.Prism(x, c.Y + 4.5, z - 12, 28, 2.5, 14, 0x5a4a3a);
            Solid(c, x, z - 12, 24, 10, 7, 0, "depot");
            mb.Cylinder(x + 40, c.Y, z - 12, 0.4, 0.3, 9, 0x5a4a3a, 5);
            mb.Cylinder(x + 40, c.Y + 9, z - 12, 3, 3, 4, 0x7a5a3a, 10);
            mb.Cylinder(x + 40, c.Y + 13, z - 12, 3.4, 0, 1.5, 0x4a3a2a, 10);
            Solid(c, x + 40, z - 12, 6, 6, 14);
        },
        ["baray"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            mb.GroundQuad(x - 90, z - 60, x + 90, z - 60, x + 90, z + 60, x - 90, z + 60, c.Y + 0.05, c.Era.Water);
            mb.Box(x, c.Y - 1, z, 24, 3, 24, 0x9a9078);
            Platform(c, x, z, 24, 24, c.Y + 2);
            Stair(c, x, c.Y, z + 16, 6, 4, 2, 0, -1, 0x9a9078);
            PagodaTower(c.With(c.Y + 2), x, z, 8, 3, 0xa89e86, 0x8a8070);
        },
        ["chinampas"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            var rng = c.Rng;
            mb.GroundQuad(x - 90, z - 60, x + 90, z - 60, x + 90, z + 60, x - 90, z + 60, c.Y + 0.05, c.Era.Water);
            for (int i = 0; i < 8; i++)
            {
                for (int j = 0; j < 5; j++)
                {
                    double px = x - 78 + i * 22;
                    double pz = z - 48 + j * 24;
                    mb.Box(px, c.Y - 0.5, pz, 16, 1.0, 16, M.Shade(0x5a8a3a, rng.Range(0.8, 1.2)));
                    Platform(c, px, pz, 16, 16, c.Y + 0.5);
                    for (int k = 0; k < 3; k++) mb.Box(px - 6 + k * 6, c.Y + 0.5, pz, 1.2, 0.8, 14, 0x4a7a2a);
                    if (rng.Chance(0.5)) Props.BuildTree(mb, px + 7, c.Y + 0.5, pz + 7, "palm", rng);
                }
            }
            for (int i = 0; i < 5; i++) BuildShip(mb, x - 60 + i * 30, c.Y - 0.6, z + 56, "canoe", rng.Range(0, 3), rng);
        },
        ["ferry_camp"] = c =>
        {
            for (int i = 0; i < 6; i++) Props.BuildProp(c.Mb, c.X - 40 + i * 16, c.Y, c.Z - 20, "tent", c.Rng, c.Rng.Range(0, 3));
            Props.BuildProp(c.Mb, c.X, c.Y, c.Z + 5, "campfire", c.Rng);
            c.Mb.Box(c.X, c.Y - 0.5, c.Z + 30, 20, 1.2, 10, 0x6a5a40);
            Platform(c, c.X, c.Z + 30, 20, 10, c.Y + 0.7, 0, "pier");
        },
        ["canoe_landing"] = c =>
        {
            c.Mb.Box(c.X, c.Y - 1, c.Z + 10, 60, 1.7, 10, 0x8e7a52);
            Platform(c, c.X, c.Z + 10, 60, 10, c.Y + 0.7, 0, "pier");
            for (int i = 0; i < 7; i++)
            {
                double sz = c.Z + 24 + c.Rng.Range(0, 6);
                double srot = 1.3 + c.Rng.Range(-0.3, 0.3);
                BuildShip(c.Mb, c.X - 30 + i * 10, c.Y - 0.6, sz, "canoe", srot, c.Rng);
            }
        },

        // ---------- arenas ----------
        ["none"] = c => { },
        ["colosseum"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int stone = 0xe6dcc4;
            for (int t = 0; t < 3; t++)
            {
                double r = 60 - t * 3;
                double y = c.Y + t * 9;
                const int n = 40;
                for (int i = 0; i < n; i++)
                {
                    double a = ((double)i / n) * Math.PI * 2;
                    mb.Box(x + Math.Cos(a) * r * 1.2, y, z + Math.Sin(a) * r, 3.2, 7, 3, M.Shade(stone, 1 - t * 0.04), a + Math.PI / 2 + Math.Atan2(Math.Sin(a) * 0.2, 1));
                }
                mb.RingWall(x, y + 7, z, r, 3.5, 2, M.Shade(stone, 0.95), n);
            }
            mb.RingWall(x, c.Y + 27, z, 55, 2, 6, M.Shade(stone, 0.9), 40);
            for (int i = 0; i < 40; i++)
            {
                double a = (i / 40.0) * Math.PI * 2;
                c.Col.Add(new Collider { X = x + Math.Cos(a) * 60 * 1.2, Z = z + Math.Sin(a) * 60, Hw = 2, Hd = 4, Rot = a + Math.PI / 2, H = 27, Tag = "arena" });
            }
            mb.GroundQuad(x - 50, z - 40, x + 50, z - 40, x + 50, z + 40, x - 50, z + 40, c.Y + 0.08, 0xd9b870);
        },
        ["stadium"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            mb.Box(x, c.Y - 1, z - 42, 150, 14, 24, 0x7a7a78);
            mb.Box(x, c.Y - 1, z + 42, 150, 14, 24, 0x7a7a78);
            Solid(c, x, z - 42, 150, 24, 14, 0, "arena");
            Solid(c, x, z + 42, 150, 24, 14, 0, "arena");
            for (int i = 0; i < 8; i++)
            {
                mb.Box(x, c.Y + 2 + i * 1.5, z - 42 + 12 - i * 3, 150, 1.5, 3, 0x9a9a98);
                mb.Box(x, c.Y + 2 + i * 1.5, z + 42 - 12 + i * 3, 150, 1.5, 3, 0x9a9a98);
            }
            mb.GroundQuad(x - 72, z - 28, x + 72, z - 28, x + 72, z + 28, x - 72, z + 28, c.Y + 0.08, 0x4f8f3a);
            foreach (double ox in new double[] { -70, 70 })
            {
                mb.Cylinder(x + ox, c.Y, z, 0.6, 0.4, 28, 0x4a4a4a, 6);
                mb.Box(x + ox, c.Y + 26, z, 4, 3, 1, 0xffffe0);
            }
        },
        ["theatre"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            for (int t = 0; t < 9; t++)
            {
                mb.RingWall(x, c.Y + t * 1.2, z, 18 + t * 4, 4.2, 1.2, M.Shade(0xe8e0d0, 1 - t * 0.02), 20 + t * 2, Math.PI, Math.PI * 2);
            }
            for (int t = 0; t < 9; t++)
            {
                double r = 18 + t * 4;
                int n = 20 + t * 2;
                double step = Math.PI / n;
                for (int i = 0; i < n; i++)
                {
                    double a = Math.PI + (i + 0.5) * step;
                    Platform(c, x + Math.Cos(a) * r, z + Math.Sin(a) * r, 2 * r * Math.Sin(step / 2) + 0.2, 4.2, c.Y + (t + 1) * 1.2, a + Math.PI / 2);
                }
            }
            // aisles: straight flights from the orchestra to the top row
            foreach (double a in new[] { Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75 })
            {
                Stair(c, x + Math.Cos(a) * 11.5, c.Y, z + Math.Sin(a) * 11.5, 2.2, 36, 10.8, Math.Cos(a), Math.Sin(a), 0xd8d0c0);
            }
            mb.Box(x, c.Y, z + 12, 40, 8, 6, 0xd9cfbc);
            Solid(c, x, z + 12, 40, 6, 8);
            mb.Cylinder(x, c.Y, z, 12, 12, 0.3, 0xcdb996, 16);
        },
        ["ballcourt"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            foreach (int s in PM)
            {
                mb.Hip(x + s * 14, c.Y - 1, z, 10, 7, 60, 4, 60, 0xd8ccb0);
                Solid(c, x + s * 14, z, 10, 60, 7);
                mb.Cylinder(x + s * 9.5, c.Y + 4, z, 1.2, 1.2, 0.6, 0x8a8a80, 10, 0);
            }
            mb.GroundQuad(x - 9, z - 30, x + 9, z - 30, x + 9, z + 30, x - 9, z + 30, c.Y + 0.08, 0xcdb996);
        },
        ["bull_court"] = c =>
        {
            WallRect(c, c.X, c.Z, 60, 40, 1.2, 2.5, 0xf1e7d2, 2, 8);
            c.Mb.GroundQuad(c.X - 28, c.Z - 18, c.X + 28, c.Z - 18, c.X + 28, c.Z + 18, c.X - 28, c.Z + 18, c.Y + 0.08, 0xd9b870);
            c.Mb.Box(c.X, c.Y, c.Z - 25, 6, 3, 4, 0x6a4a3a);
        },
        ["siege_yard"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            for (int i = 0; i < 3; i++)
            {
                double tx = x - 30 + i * 30;
                mb.Box(tx, c.Y, z, 8, 18, 8, 0x7a5a3a);
                mb.Box(tx, c.Y + 18, z, 9, 2, 9, 0x5a4a3a);
                foreach (int s in PM) mb.Cylinder(tx + s * 3.5, c.Y, z + 4.5, 1.2, 1.2, 0.8, 0x3a3a3a, 8);
                Solid(c, tx, z, 8, 8, 18);
            }
            mb.Box(x, c.Y + 1.5, z + 25, 14, 1, 1, 0x5a4a3a);
            mb.Box(x, c.Y + 0.5, z + 25, 1, 2, 3, 0x5a4a3a);
            mb.Box(x + 7, c.Y + 1.5, z + 25, 1.5, 1.5, 1.5, 0x3a3a3a);
        },
        ["elephant_ground"] = c =>
        {
            Fence(c, c.X, c.Z, 80, 60, 0x6a4a3a);
            for (int i = 0; i < 4; i++)
            {
                double ex = c.X - 30 + i * 20;
                c.Mb.Box(ex, c.Y + 1.8, c.Z, 6, 3.4, 3.2, 0x7a7a78);
                c.Mb.Box(ex + 3.5, c.Y + 2.8, c.Z, 2.6, 2.6, 2.4, 0x7a7a78);
                c.Mb.Box(ex + 5, c.Y + 0.5, c.Z, 0.8, 3, 0.8, 0x7a7a78);
                foreach (var o in new[] { new double[] { -2, -1 }, new double[] { 2, -1 }, new double[] { -2, 1 }, new double[] { 2, 1 } })
                    c.Mb.Cylinder(ex + o[0], c.Y, c.Z + o[1], 0.5, 0.5, 1.8, 0x6a6a68, 6);
                Solid(c, ex, c.Z, 8, 3.2, 5);
            }
        },
        ["thing_mound"] = c =>
        {
            c.Mb.Dome(c.X, c.Y - 2, c.Z, 22, 0x5f7a44, 14, 4);
            for (int i = 0; i < 12; i++)
            {
                double a = (i / 12.0) * Math.PI * 2;
                Props.BuildProp(c.Mb, c.X + Math.Cos(a) * 32, c.Y, c.Z + Math.Sin(a) * 32, "runestone", c.Rng, a);
            }
            Solid(c, c.X, c.Z, 20, 20, 8);
        },
        ["elephant_terrace"] = c =>
        {
            c.Mb.Box(c.X, c.Y - 1, c.Z, 100, 4, 20, 0x9a9078);
            Platform(c, c.X, c.Z, 100, 20, c.Y + 3);
            Stair(c, c.X, c.Y, c.Z + 16, 8, 6, 3, 0, -1, 0x9a9078);
            for (int i = 0; i < 6; i++)
            {
                double ex = c.X - 40 + i * 16;
                c.Mb.Box(ex, c.Y + 1, c.Z + 11, 5, 3, 2.5, 0x8a8070);
                c.Mb.Box(ex, c.Y + 0, c.Z + 13, 1.2, 2, 1.2, 0x8a8070);
            }
        },
        ["horse_field"] = c =>
        {
            Fence(c, c.X, c.Z, 90, 70, 0x6a5a40, 4);
            for (int i = 0; i < 6; i++)
            {
                double hx = c.X - 30 + i * 12;
                double hz = c.Z + c.Rng.Range(-20, 20);
                int col = c.Rng.Pick(HORSE_COLORS);
                double rot = c.Rng.Range(0, 3);
                c.Mb.Box(hx, c.Y + 1.2, hz, 2.4, 1.3, 0.9, col, rot);
                c.Mb.Box(hx + 1.3, c.Y + 1.8, hz, 1.0, 1.0, 0.6, 0x5a4030);
            }
        },
        ["drill_ground"] = c =>
        {
            Fence(c, c.X, c.Z, 70, 50, 0x6a5a40, 4);
            for (int i = 0; i < 5; i++)
            {
                c.Mb.Box(c.X - 24 + i * 12, c.Y, c.Z - 20, 0.3, 2.2, 0.3, 0x5a4a3a);
                c.Mb.Cylinder(c.X - 24 + i * 12, c.Y + 1.2, c.Z - 19.8, 0.7, 0.7, 0.1, 0xe8e0d0, 8, 0);
            }
        },
        ["gallows_green"] = c =>
        {
            c.Mb.Box(c.X, c.Y, c.Z, 8, 1.2, 6, 0x6a5a40);
            c.Mb.Box(c.X - 3, c.Y + 1.2, c.Z, 0.4, 5, 0.4, 0x5a4a3a);
            c.Mb.Box(c.X - 0.5, c.Y + 6, c.Z, 5.5, 0.4, 0.4, 0x5a4a3a);
            Platform(c, c.X, c.Z, 8, 6, c.Y + 1.2);
            Stair(c, c.X + 7.5, c.Y, c.Z, 3, 3.5, 1.2, -1, 0, 0x6a5a40);
            Column(c, c.X - 3, c.Z, 0.3, 6);
            for (int i = 0; i < 4; i++) Props.BuildTree(c.Mb, c.X - 30 + i * 20, c.Y, c.Z + 25, "palm", c.Rng);
        },
        ["corral"] = c =>
        {
            Fence(c, c.X, c.Z, 60, 44, 0x8a6a4a, 3);
            for (int i = 0; i < 8; i++)
            {
                double hx = c.X + c.Rng.Range(-25, 25);
                double hz = c.Z + c.Rng.Range(-18, 18);
                int col = c.Rng.Pick(CORRAL_COLORS);
                double rot = c.Rng.Range(0, 3);
                c.Mb.Box(hx, c.Y + 1.0, hz, 2.2, 1.2, 0.9, col, rot);
            }
        },
        ["crystal_palace"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            const int glass = 0x9fd0e8;
            mb.Box(x, c.Y - 1, z, 140, 14, 50, glass);
            mb.Prism(x, c.Y + 13, z, 142, 8, 52, 0xb8e0f0);
            mb.Box(x, c.Y + 13, z, 60, 10, 30, glass);
            mb.Hip(x, c.Y + 23, z, 62, 8, 32, 50, 20, 0xb8e0f0);
            for (int i = 0; i < 24; i++) mb.Box(x - 69 + i * 6, c.Y - 1, z, 0.5, 14, 50.4, 0xe8e8e8);
            Solid(c, x, z, 140, 50, 22, 0, "civic");
        },

        // ---------- plazas ----------
        ["temple_sumer"] = c =>
        {
            WallRect(c, c.X, c.Z, 50, 40, 2, 4, 0xc4a46c, 2, 6);
            c.Mb.Box(c.X, c.Y, c.Z - 5, 24, 8, 16, 0xd2b483);
            Solid(c, c.X, c.Z - 5, 24, 16, 8, 0, "temple");
        },
        ["temple_egypt"] = c =>
        {
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            foreach (int s in PM)
            {
                mb.Hip(x + s * 14, c.Y - 1, z + 30, 16, 16, 7, 12, 5, 0xe8d8ad);
                Solid(c, x + s * 14, z + 30, 16, 7, 16);
                Props.BuildProp(mb, x + s * 26, c.Y, z + 40, "obelisk", c.Rng);
            }
            mb.Box(x, c.Y + 10, z + 30, 12, 6, 6, 0xe0d0a8);
            mb.Box(x, c.Y, z - 5, 44, 9, 50, 0xf0dfb4);
            Solid(c, x, z - 5, 44, 50, 9, 0, "temple");
            for (int i = 0; i < 6; i++)
            {
                mb.Cylinder(x - 15 + i * 6, c.Y, z + 22, 1.0, 0.9, 8, 0xe8dcc0, 8);
                Column(c, x - 15 + i * 6, z + 22, 1.0, 8);
            }
        },
        ["court_minoan"] = c =>
        {
            c.Mb.GroundQuad(c.X - 30, c.Z - 20, c.X + 30, c.Z - 20, c.X + 30, c.Z + 20, c.X - 30, c.Z + 20, c.Y + 0.08, 0xe8dcc0);
            for (int i = 0; i < 4; i++)
            {
                c.Mb.Cylinder(c.X - 18 + i * 12, c.Y, c.Z - 18, 0.5, 0.8, 4, 0xb03a2a, 8);
                Column(c, c.X - 18 + i * 12, c.Z - 18, 0.8, 4);
            }
            Props.BuildProp(c.Mb, c.X, c.Y, c.Z, "fountain", c.Rng);
        },
        ["tholos"] = c =>
        {
            c.Mb.Dome(c.X, c.Y - 2, c.Z, 16, 0x7f7f74, 14, 4);
            c.Mb.Box(c.X, c.Y, c.Z + 14, 6, 6, 8, 0x9a8f78);
            Solid(c, c.X, c.Z, 28, 28, 12, 0, "tomb");
        },
        ["lamassu_gate"] = c =>
        {
            foreach (int s in PM)
            {
                c.Mb.Box(c.X + s * 8, c.Y, c.Z, 6, 9, 10, 0xcfae78);
                c.Mb.Box(c.X + s * 8, c.Y + 2, c.Z + 6, 3.5, 5, 7, 0xe8dcc0);
                c.Mb.Box(c.X + s * 8, c.Y + 7, c.Z + 9, 2.4, 2.6, 2.4, 0xe8dcc0);
                Solid(c, c.X + s * 8, c.Z + 2, 6, 16, 9);
            }
            c.Mb.Box(c.X, c.Y + 9, c.Z, 22, 2.5, 10, 0xc9a56c);
        },
        ["agora"] = c =>
        {
            c.Mb.GroundQuad(c.X - 50, c.Z - 40, c.X + 50, c.Z - 40, c.X + 50, c.Z + 40, c.X - 50, c.Z + 40, c.Y + 0.08, 0xd9d0bd);
            for (int i = 0; i < 5; i++) Props.BuildProp(c.Mb, c.X - 40 + i * 20, c.Y, c.Z - 30, "statue", c.Rng, Math.PI / 2);
            Props.BuildProp(c.Mb, c.X, c.Y, c.Z, "fountain", c.Rng);
            for (int i = 0; i < 6; i++) Props.BuildProp(c.Mb, c.X - 25 + i * 10, c.Y, c.Z + 30, "stall", c.Rng, 0);
            c.Mb.Cylinder(c.X + 40, c.Y, c.Z + 30, 4, 4, 1, 0xe8e0d0, 10);
            c.Mb.Box(c.X + 40, c.Y + 1, c.Z + 30, 1.6, 1.2, 1.6, 0xe8e0d0);
        },
        ["ashoka_pillar"] = c =>
        {
            c.Mb.Cylinder(c.X, c.Y, c.Z, 1.3, 1.0, 16, 0xe9dfc8, 12);
            c.Mb.Dome(c.X, c.Y + 16, c.Z, 1.8, 0xd9c08a, 8, 2);
            c.Mb.Box(c.X, c.Y + 17.8, c.Z, 3, 2.6, 3, 0xd9c08a);
            Solid(c, c.X, c.Z, 3, 3, 20);
            for (int i = 0; i < 8; i++)
            {
                double a = (i / 8.0) * Math.PI * 2;
                Props.BuildTree(c.Mb, c.X + Math.Cos(a) * 30, c.Y, c.Z + Math.Sin(a) * 30, "jungle", c.Rng);
            }
        },
        ["forum"] = c =>
        {
            c.Mb.GroundQuad(c.X - 60, c.Z - 40, c.X + 60, c.Z - 40, c.X + 60, c.Z + 40, c.X - 60, c.Z + 40, c.Y + 0.08, 0xd9d0bd);
            for (int i = 0; i < 8; i++)
            {
                c.Mb.Cylinder(c.X - 42 + i * 12, c.Y, c.Z - 34, 0.8, 0.7, 9, 0xf0e8d8, 8);
                c.Mb.Cylinder(c.X - 42 + i * 12, c.Y, c.Z + 34, 0.8, 0.7, 9, 0xf0e8d8, 8);
                Column(c, c.X - 42 + i * 12, c.Z - 34, 0.8, 9);
                Column(c, c.X - 42 + i * 12, c.Z + 34, 0.8, 9);
            }
            c.Mb.Box(c.X, c.Y + 9, c.Z - 34, 100, 1.2, 3, 0xe8e0d0);
            c.Mb.Box(c.X, c.Y + 9, c.Z + 34, 100, 1.2, 3, 0xe8e0d0);
            // Trajan's column
            c.Mb.Box(c.X, c.Y, c.Z, 7, 4, 7, 0xe8e0d0);
            c.Mb.Cylinder(c.X, c.Y + 4, c.Z, 1.8, 1.6, 30, 0xf0e8d8, 12);
            c.Mb.Box(c.X, c.Y + 34, c.Z, 1.2, 2.5, 1.2, 0xb8a24a);
            Solid(c, c.X, c.Z, 7, 7, 36);
            for (int i = 0; i < 4; i++) Props.BuildProp(c.Mb, c.X - 30 + i * 20, c.Y, c.Z + 12, "statue", c.Rng, Math.PI);
        },
        ["stela_plaza"] = c =>
        {
            c.Mb.GroundQuad(c.X - 40, c.Z - 30, c.X + 40, c.Z - 30, c.X + 40, c.Z + 30, c.X - 40, c.Z + 30, c.Y + 0.08, 0xdccfb0);
            for (int i = 0; i < 7; i++) Props.BuildProp(c.Mb, c.X - 30 + i * 10, c.Y, c.Z - 15, "stele", c.Rng, 0);
            for (int i = 0; i < 3; i++) Props.BuildProp(c.Mb, c.X - 20 + i * 20, c.Y, c.Z + 15, "altar", c.Rng, 0);
        },
        ["runestone_ring"] = c =>
        {
            for (int i = 0; i < 9; i++)
            {
                double a = (i / 9.0) * Math.PI * 2;
                Props.BuildProp(c.Mb, c.X + Math.Cos(a) * 14, c.Y, c.Z + Math.Sin(a) * 14, "runestone", c.Rng, a + Math.PI / 2);
            }
            Props.BuildProp(c.Mb, c.X, c.Y, c.Z, "campfire", c.Rng);
        },
        ["bayon_faces"] = c =>
        {
            const int stone = 0x9a9078;
            for (int i = 0; i < 4; i++) c.Mb.Box(c.X, c.Y + i * 6, c.Z, 20 - i * 3, 6, 20 - i * 3, M.Shade(stone, 1 + i * 0.03));
            foreach (var f in new[] { new double[] { 0, -9, 0 }, new double[] { 9, 0, Math.PI / 2 }, new double[] { 0, 9, Math.PI }, new double[] { -9, 0, -Math.PI / 2 } })
            {
                double ox = f[0], oz = f[1], r = f[2];
                c.Mb.Box(c.X + ox, c.Y + 14, c.Z + oz, 6, 7, 2, M.Shade(stone, 1.1), r);
                c.Mb.Box(c.X + ox * 1.1, c.Y + 16, c.Z + oz * 1.1, 1.2, 1.2, 0.5, M.Shade(stone, 0.8), r);
            }
            c.Mb.Hip(c.X, c.Y + 24, c.Z, 10, 6, 10, 0, 0, M.Shade(stone, 1.1));
            Solid(c, c.X, c.Z, 20, 20, 30, 0, "temple");
        },
        ["standard_pole"] = c =>
        {
            c.Mb.Cylinder(c.X, c.Y, c.Z, 0.4, 0.2, 12, 0x3a2a1a, 6);
            for (int i = 0; i < 9; i++)
            {
                double a = (i / 9.0) * Math.PI * 2;
                c.Mb.Box(c.X + Math.Cos(a) * 1.2, c.Y + 10, c.Z + Math.Sin(a) * 1.2, 0.3, 2.2, 0.3, 0x2a2a2a);
            }
            for (int i = 0; i < 6; i++) Props.BuildProp(c.Mb, c.X + Math.Cos(i) * 20, c.Y, c.Z + Math.Sin(i) * 20, "tent", c.Rng, i);
        },
        ["skull_rack"] = c =>
        {
            c.Mb.Box(c.X, c.Y, c.Z, 30, 1.5, 6, 0xe6dcc4);
            for (int i = 0; i < 7; i++) c.Mb.Box(c.X - 14 + i * 4.7, c.Y + 1.5, c.Z, 0.4, 6, 0.4, 0x5a4a3a);
            for (int r = 0; r < 4; r++) for (int i = 0; i < 24; i++) c.Mb.Box(c.X - 13.5 + i * 1.18, c.Y + 2.5 + r * 1.1, c.Z, 0.7, 0.7, 0.7, 0xf0ead8);
            Solid(c, c.X, c.Z, 30, 6, 7);
        },
        ["torii"] = c =>
        {
            const int red = 0xc8372d;
            foreach (int s in PM) c.Mb.Cylinder(c.X + s * 5, c.Y, c.Z, 0.6, 0.5, 9, red, 8);
            c.Mb.Box(c.X, c.Y + 8.5, c.Z, 15, 0.8, 0.8, 0x2a2a2a);
            c.Mb.Box(c.X, c.Y + 7, c.Z, 12, 0.6, 0.6, red);
            Solid(c, c.X - 5, c.Z, 1.2, 1.2, 9);
            Solid(c, c.X + 5, c.Z, 1.2, 1.2, 9);
            for (int i = 0; i < 6; i++) Props.BuildProp(c.Mb, c.X - 25 + i * 10, c.Y, c.Z + 15, "lantern", c.Rng);
            for (int i = 0; i < 4; i++) Props.BuildTree(c.Mb, c.X - 30 + i * 20, c.Y, c.Z - 20, "pine", c.Rng);
        },
        ["tavern_square"] = c =>
        {
            c.Mb.Box(c.X, c.Y, c.Z - 20, 26, 7, 14, 0xd9c7a0);
            c.Mb.Prism(c.X, c.Y + 7, c.Z - 20, 28, 4, 16, 0x5a4a3a);
            Solid(c, c.X, c.Z - 20, 26, 14, 11, 0, "tavern");
            c.Mb.Box(c.X, c.Y + 4.5, c.Z - 12.7, 5, 1.4, 0.3, 0x3a2a2a);
            for (int i = 0; i < 6; i++) Props.BuildProp(c.Mb, c.X - 20 + i * 8, c.Y, c.Z + 10, "barrel", c.Rng);
            Props.BuildProp(c.Mb, c.X + 20, c.Y, c.Z, "cannon", c.Rng, 0.4);
            Props.BuildProp(c.Mb, c.X - 20, c.Y, c.Z, "signpost", c.Rng, 0.3);
        },
        ["water_tower"] = c =>
        {
            foreach (var o in new[] { new double[] { -3, -3 }, new double[] { 3, -3 }, new double[] { 3, 3 }, new double[] { -3, 3 } })
                c.Mb.Box(c.X + o[0], c.Y, c.Z + o[1], 0.5, 12, 0.5, 0x5a4a3a);
            c.Mb.Cylinder(c.X, c.Y + 12, c.Z, 4, 4, 5, 0x7a5a3a, 10);
            c.Mb.Cylinder(c.X, c.Y + 17, c.Z, 4.4, 0, 2, 0x4a3a2a, 10);
            Solid(c, c.X, c.Z, 7, 7, 19);
            for (int i = 0; i < 3; i++) Props.BuildProp(c.Mb, c.X - 15 + i * 15, c.Y, c.Z + 15, "wagon", c.Rng, c.Rng.Range(0, 3));
        },
        ["victoria_square"] = c =>
        {
            c.Mb.GroundQuad(c.X - 40, c.Z - 30, c.X + 40, c.Z - 30, c.X + 40, c.Z + 30, c.X - 40, c.Z + 30, c.Y + 0.08, 0x8a8a88);
            c.Mb.Box(c.X, c.Y, c.Z, 6, 6, 6, 0x9a9a98);
            c.Mb.Box(c.X, c.Y + 6, c.Z, 2, 5, 2, 0x4a4a48);
            c.Mb.Box(c.X, c.Y + 11, c.Z, 1.4, 1.2, 1.4, 0x4a4a48);
            Solid(c, c.X, c.Z, 6, 6, 12);
            for (int i = 0; i < 4; i++) Props.BuildProp(c.Mb, c.X - 30 + i * 20, c.Y, c.Z - 22, "gaslamp", c.Rng);
            Props.BuildProp(c.Mb, c.X - 25, c.Y, c.Z + 12, "fountain", c.Rng);
            Props.BuildProp(c.Mb, c.X + 25, c.Y, c.Z + 12, "fountain", c.Rng);
        },
        ["war_memorial"] = c =>
        {
            c.Mb.GroundQuad(c.X - 40, c.Z - 30, c.X + 40, c.Z - 30, c.X + 40, c.Z + 30, c.X - 40, c.Z + 30, c.Y + 0.08, 0x8a8a88);
            c.Mb.Box(c.X, c.Y, c.Z, 10, 2, 10, 0xb8b0a0);
            c.Mb.Hip(c.X, c.Y + 2, c.Z, 4, 22, 4, 1.5, 1.5, 0xc8c0b0);
            Solid(c, c.X, c.Z, 10, 10, 24);
            for (int i = 0; i < 4; i++) Props.BuildProp(c.Mb, c.X - 30 + i * 20, c.Y, c.Z + 20, "statue", c.Rng, Math.PI);
            for (int i = 0; i < 6; i++) Props.BuildProp(c.Mb, c.X - 25 + i * 10, c.Y, c.Z - 22, "bench", c.Rng, 0);
            for (int i = 0; i < 5; i++) Props.BuildTree(c.Mb, c.X - 36 + i * 18, c.Y, c.Z - 28, "oak", c.Rng);
        },

        // ---------- sacred ----------
        ["standing_stones"] = c =>
        {
            for (int i = 0; i < 12; i++)
            {
                double a = (i / 12.0) * Math.PI * 2;
                c.Mb.Box(c.X + Math.Cos(a) * 20, c.Y - 0.5, c.Z + Math.Sin(a) * 20, 2.2, 5 + (i % 3), 1.2, 0x8a8a80, a + Math.PI / 2);
                c.Col.Add(new Collider { X = c.X + Math.Cos(a) * 20, Z = c.Z + Math.Sin(a) * 20, Hw = 1.2, Hd = 0.7, Rot = a + Math.PI / 2, H = 5 });
            }
            Props.BuildProp(c.Mb, c.X, c.Y, c.Z, "altar", c.Rng);
        },
        ["sphinx"] = c =>
        {
            c.Mb.Box(c.X, c.Y - 1, c.Z, 20, 10, 56, 0xe8d8ad);
            c.Mb.Box(c.X, c.Y + 9, c.Z - 22, 12, 12, 10, 0xe8d8ad);
            c.Mb.Box(c.X, c.Y + 20, c.Z - 24, 14, 4, 6, 0xd9c08a);
            c.Mb.Box(c.X, c.Y + 4, c.Z + 10, 24, 5, 30, 0xe0d0a8);
            Solid(c, c.X, c.Z, 24, 56, 20, 0, "sphinx");
        },
        ["peak_sanctuary"] = c =>
        {
            c.Mb.Dome(c.X, c.Y - 4, c.Z, 30, 0xb6b08a, 14, 4);
            c.Mb.Box(c.X, c.Y + 10, c.Z, 10, 5, 8, 0xf1e7d2);
            c.Mb.Box(c.X, c.Y + 15, c.Z, 11, 0.5, 9, 0xb03a2a);
            Solid(c, c.X, c.Z, 30, 30, 15);
        },
        ["grave_circle"] = c =>
        {
            c.Mb.RingWall(c.X, c.Y, c.Z, 22, 2, 1.5, 0x9a8f78, 24);
            for (int i = 0; i < 6; i++)
            {
                double a = (i / 6.0) * Math.PI * 2;
                Props.BuildProp(c.Mb, c.X + Math.Cos(a) * 10, c.Y, c.Z + Math.Sin(a) * 10, "stele", c.Rng, a);
            }
            c.Col.Add(new Collider { X = c.X, Z = c.Z, Hw = 0, Hd = 0, Rot = 0, H = 0 });
        },
        ["ziggurat_small"] = c => Ziggurat(c, c.X, c.Z, 50, 2, 0xc9a56c),
        ["oracle"] = c =>
        {
            c.Mb.Cylinder(c.X, c.Y - 1, c.Z, 14, 14, 2, 0xf4efe4, 16);
            RoundPlatform(c, c.X, c.Z, 14, c.Y + 1);
            Stair(c, c.X, c.Y, c.Z + 16.5, 4, 3, 1, 0, -1, 0xe8e0d0);
            for (int i = 0; i < 12; i++)
            {
                // offset half a bay so the front (toward +z) is an opening, not a column
                double a = ((i + 0.5) / 12) * Math.PI * 2;
                c.Mb.Cylinder(c.X + Math.Cos(a) * 11, c.Y + 1, c.Z + Math.Sin(a) * 11, 0.7, 0.6, 8, 0xf4efe4, 8);
                Column(c, c.X + Math.Cos(a) * 11, c.Z + Math.Sin(a) * 11, 0.7, 9);
            }
            c.Mb.Cylinder(c.X, c.Y + 9, c.Z, 13, 10, 1.5, 0xe8e0d0, 16);
            c.Mb.Cylinder(c.X, c.Y + 10.5, c.Z, 13, 0, 4, 0xb5533b, 16);
            for (int i = 0; i < 5; i++) Props.BuildTree(c.Mb, c.X - 30 + i * 15, c.Y, c.Z + 28, "cypress", c.Rng);
        },
        ["great_stupa"] = c =>
        {
            c.Mb.Cylinder(c.X, c.Y - 1, c.Z, 30, 30, 4, 0xe6d6b2, 20);
            RoundPlatform(c, c.X, c.Z, 30, c.Y + 3);
            RoundSolid(c, c.X, c.Z, 25.5, 30, "stupa");
            c.Mb.Dome(c.X, c.Y + 3, c.Z, 26, 0xf1e9d4, 20, 6);
            c.Mb.Box(c.X, c.Y + 28, c.Z, 6, 3, 6, 0xd9c08a);
            c.Mb.Cylinder(c.X, c.Y + 31, c.Z, 0.4, 0.3, 6, 0x8a6a3a, 6);
            for (int i = 0; i < 3; i++) c.Mb.Cylinder(c.X, c.Y + 33 + i * 1.3, c.Z, 3 - i * 0.8, 3 - i * 0.8, 0.3, 0xd9c08a, 10);
            foreach (var o in new[] { new double[] { 0, 38 }, new double[] { 38, 0 }, new double[] { 0, -38 }, new double[] { -38, 0 } })
            {
                double ox = o[0], oz = o[1];
                double len = M.Hypot(ox, oz);
                Stair(c, c.X + (ox / len) * 34.5, c.Y, c.Z + (oz / len) * 34.5, 4, 4.5, 3, -ox / len, -oz / len, 0xe6d6b2);
                // torana gateway: two posts and a lintel, open in the middle
                double tx = -oz / len;
                double tz = ox / len;
                foreach (int s2 in PM)
                {
                    c.Mb.Box(c.X + ox + tx * 3.5 * s2, c.Y, c.Z + oz + tz * 3.5 * s2, 1.2, 8, 1.2, 0xd8c8a0);
                    Column(c, c.X + ox + tx * 3.5 * s2, c.Z + oz + tz * 3.5 * s2, 0.6, 8);
                }
                c.Mb.Box(c.X + ox, c.Y + 8, c.Z + oz, 9, 1.2, 1.2, 0xd8c8a0, Math.Atan2(oz, ox) + Math.PI / 2);
            }
        },
        ["pantheon"] = c =>
        {
            c.Mb.Cylinder(c.X, c.Y - 1, c.Z, 22, 22, 16, 0xe8dabd, 20);
            c.Mb.Dome(c.X, c.Y + 15, c.Z, 22, 0xb8b0a0, 20, 5);
            c.Mb.Box(c.X, c.Y, c.Z + 30, 30, 1.5, 16, 0xf0e8d8);
            Platform(c, c.X, c.Z + 30, 30, 16, c.Y + 1.5);
            Stair(c, c.X, c.Y, c.Z + 41.5, 12, 3.5, 1.5, 0, -1, 0xe8e0d0);
            for (int i = 0; i < 8; i++)
            {
                c.Mb.Cylinder(c.X - 12 + i * 3.4, c.Y + 1.5, c.Z + 36, 0.8, 0.7, 12, 0xf4efe4, 8);
                Column(c, c.X - 12 + i * 3.4, c.Z + 36, 0.8, 14);
            }
            c.Mb.Box(c.X, c.Y + 13.5, c.Z + 30, 32, 2, 18, 0xf0e8d8);
            c.Mb.Prism(c.X, c.Y + 15.5, c.Z + 30, 18, 5, 34, 0xd9cfbc, Math.PI / 2);
            RoundSolid(c, c.X, c.Z, 22, 30, "temple");
        },
        ["observatory"] = c =>
        {
            c.Mb.Box(c.X, c.Y - 1, c.Z, 36, 8, 36, 0xdccfb0);
            Platform(c, c.X, c.Z, 36, 36, c.Y + 7);
            c.Mb.Cylinder(c.X, c.Y + 7, c.Z, 10, 9, 10, 0xe9dcc0, 12);
            c.Mb.Dome(c.X, c.Y + 17, c.Z, 9, 0xd0c4a8, 12, 3);
            RoundSolid(c, c.X, c.Z, 10, 26, "observatory");
            Stair(c, c.X, c.Y - 1, c.Z + 30, 8, 12, 8, 0, -1, 0xc8b898);
        },
        ["hof"] = c =>
        {
            c.Mb.Box(c.X, c.Y - 1, c.Z, 24, 8, 14, 0x4e3a28);
            c.Mb.Prism(c.X, c.Y + 7, c.Z, 28, 10, 20, 0x4f4a3a);
            c.Mb.Prism(c.X, c.Y + 14, c.Z, 14, 5, 10, 0x4f4a3a);
            Solid(c, c.X, c.Z, 24, 14, 20, 0, "temple");
            for (int i = 0; i < 4; i++) Props.BuildProp(c.Mb, c.X - 18 + i * 12, c.Y, c.Z + 14, "totem", c.Rng);
            for (int i = 0; i < 6; i++) Props.BuildTree(c.Mb, c.X - 35 + i * 14, c.Y, c.Z - 22, "pine", c.Rng);
        },
        ["naga_bridge"] = c =>
        {
            c.Mb.Box(c.X, c.Y, c.Z, 60, 2, 10, 0xa89e86);
            Platform(c, c.X, c.Z, 60, 10, c.Y + 2);
            foreach (int s in PM)
            {
                Stair(c, c.X + s * 35, c.Y, c.Z, 6, 5, 2, -s, 0, 0xa89e86);
                Solid(c, c.X, c.Z + s * 5, 56, 1, 2, 0, "rail");
            }
            for (int i = 0; i < 12; i++)
            {
                foreach (int s in PM) c.Mb.Box(c.X - 27 + i * 5, c.Y + 2, c.Z + s * 5, 1.4, 1.6, 1.0, 0x9a9078);
            }
            foreach (int s in PM)
            {
                c.Mb.Hip(c.X + s * 31, c.Y + 2, c.Z + 5, 3, 4, 2, 1.5, 1, 0x9a9078);
                c.Mb.Hip(c.X + s * 31, c.Y + 2, c.Z - 5, 3, 4, 2, 1.5, 1, 0x9a9078);
            }
        },
        ["ovoo"] = c =>
        {
            c.Mb.Cylinder(c.X, c.Y - 0.5, c.Z, 5, 1.5, 4.5, 0x8a8a80, 10);
            c.Mb.Cylinder(c.X, c.Y + 4, c.Z, 0.2, 0.1, 4, 0x5a4a3a, 5);
            for (int i = 0; i < 8; i++)
            {
                double a = (i / 8.0) * Math.PI * 2;
                c.Mb.Box(c.X + Math.Cos(a) * 1.8, c.Y + 5.5, c.Z + Math.Sin(a) * 1.8, 0.6, 0.6, 0.05, c.Rng.Pick(OVOO_COLORS), a);
            }
            Solid(c, c.X, c.Z, 9, 9, 5);
        },
        ["sun_stone"] = c =>
        {
            c.Mb.Box(c.X, c.Y, c.Z, 10, 2, 10, 0xd8ccb0);
            c.Mb.Cylinder(c.X, c.Y + 2, c.Z, 5, 5, 1.2, 0x9a8a78, 16);
            c.Mb.Cylinder(c.X, c.Y + 3.2, c.Z, 2.5, 2.5, 0.3, 0xd9a52a, 12);
            Solid(c, c.X, c.Z, 10, 10, 4);
            for (int i = 0; i < 4; i++) Props.BuildProp(c.Mb, c.X - 15 + i * 10, c.Y, c.Z + 12, "torch", c.Rng);
        },
        ["pagoda_tower"] = c => PagodaTower(c, c.X, c.Z, 12, 5, 0xb8392e, 0x3a3a3c),
        ["lighthouse"] = c =>
        {
            c.Mb.Cylinder(c.X, c.Y - 1, c.Z, 5, 3.4, 26, 0xeee6d2, 12);
            for (int i = 0; i < 4; i++) c.Mb.Cylinder(c.X, c.Y + 3 + i * 6, c.Z, 5 - i * 0.4, 5 - i * 0.4, 1.4, 0xb03020, 12);
            c.Mb.Cylinder(c.X, c.Y + 25, c.Z, 3.6, 3.6, 3, 0xffe8a0, 10);
            c.Mb.Cylinder(c.X, c.Y + 28, c.Z, 4, 0, 2.5, 0x2a2a2a, 10);
            Solid(c, c.X, c.Z, 10, 10, 30, 0, "lighthouse");
        },
        ["church_white"] = c =>
        {
            c.Mb.Box(c.X, c.Y - 1, c.Z, 14, 7, 26, 0xf0ece0);
            c.Mb.Prism(c.X, c.Y + 6, c.Z, 16, 5, 28, 0x5a4a3a, Math.PI / 2);
            c.Mb.Box(c.X, c.Y, c.Z + 10, 5, 14, 5, 0xf0ece0);
            c.Mb.Hip(c.X, c.Y + 14, c.Z + 10, 5.5, 7, 5.5, 0, 0, 0x5a4a3a);
            Solid(c, c.X, c.Z, 14, 26, 11, 0, "church");
        },
        ["gothic_cathedral"] = c =>
        {
            const int stone = 0x9a9a9a;
            c.Mb.Box(c.X, c.Y - 1, c.Z, 30, 26, 80, stone);
            c.Mb.Prism(c.X, c.Y + 25, c.Z, 32, 10, 82, 0x3a3a42, Math.PI / 2);
            foreach (int s in PM)
            {
                c.Mb.Box(c.X + s * 12, c.Y - 1, c.Z + 36, 10, 50, 10, stone);
                c.Mb.Hip(c.X + s * 12, c.Y + 49, c.Z + 36, 10, 22, 10, 0, 0, M.Shade(stone, 0.8));
                Solid(c, c.X + s * 12, c.Z + 36, 10, 10, 70);
            }
            for (int i = 0; i < 8; i++)
            {
                foreach (int s in PM) c.Mb.Box(c.X + s * 17, c.Y - 1, c.Z - 30 + i * 9, 4, 14, 2, M.Shade(stone, 0.9));
            }
            c.Mb.Cylinder(c.X, c.Y + 35, c.Z + 36, 3, 3, 0.4, 0x3a5a9a, 12, 0);
            Solid(c, c.X, c.Z, 30, 80, 30, 0, "cathedral");
        },
        ["cathedral_stone"] = c =>
        {
            const int stone = 0x8a8278;
            c.Mb.Box(c.X, c.Y - 1, c.Z, 28, 22, 70, stone);
            c.Mb.Prism(c.X, c.Y + 21, c.Z, 30, 8, 72, 0x4a4a52, Math.PI / 2);
            c.Mb.Box(c.X, c.Y - 1, c.Z + 30, 14, 48, 14, stone);
            c.Mb.Hip(c.X, c.Y + 47, c.Z + 30, 14, 14, 14, 0, 0, 0x4a4a52);
            Solid(c, c.X, c.Z, 28, 70, 30, 0, "cathedral");
            Solid(c, c.X, c.Z + 30, 14, 14, 60);
        },

        // ---------- era specials ----------
        ["thermae"] = c =>
        {
            // Roman baths: big vaulted hall, domed caldarium, colonnaded palaestra, with the market stalls beside
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            var rng = c.Rng;
            const int stone = 0xe6dcc4;
            mb.Material(Tile.BRICK, 0.7);
            mb.Box(x, c.Y - 1, z - 8, 56, 12, 26, 0xc9a56c, 0, 0.78);
            Solid(c, x, z - 8, 56, 26, 12, 0, "baths");
            mb.Material(Tile.ROOFTILE, 0.7);
            mb.Prism(x, c.Y + 11, z - 8, 58, 6, 28, 0xb04f36);
            mb.Material(Tile.BRICK, 0.7);
            mb.Cylinder(x + 36, c.Y - 1, z - 8, 11, 11, 10, 0xc9a56c, 14);
            mb.Material(Tile.CONCRETE, 0.4);
            mb.Dome(x + 36, c.Y + 9, z - 8, 11, stone, 14, 4);
            Solid(c, x + 36, z - 8, 22, 22, 18, 0, "baths");
            // arched openings along the front
            mb.Material(Tile.CONCRETE, 0.3);
            for (int i = 0; i < 6; i++) mb.ArchQuad(x - 22 + i * 8.8, c.Y, z + 5.05, 3.2, 6.5, 0, 1, 0x1e2228);
            // palaestra: colonnaded courtyard in front
            mb.Material(Tile.STONE, 0.35);
            for (int i = 0; i < 9; i++)
            {
                mb.Cylinder(x - 28 + i * 7, c.Y, z + 30, 0.6, 0.5, 5, stone, 8);
                Column(c, x - 28 + i * 7, z + 30, 0.6, 5);
                if (i == 0 || i == 8)
                {
                    for (int j = 1; j < 3; j++)
                    {
                        mb.Cylinder(x - 28 + i * 7, c.Y, z + 30 - j * 7, 0.6, 0.5, 5, stone, 8);
                        Column(c, x - 28 + i * 7, z + 30 - j * 7, 0.6, 5);
                    }
                }
            }
            mb.Material(Tile.SLAB, 0.35);
            mb.Box(x, c.Y + 5, z + 30, 58, 0.6, 2.2, stone);
            mb.GroundQuad(x - 28, z + 8, x + 28, z + 8, x + 28, z + 30, x - 28, z + 30, c.Y + 0.08, 0xd9d0bd);
            Props.BuildProp(mb, x, c.Y, z + 19, "fountain", rng);
            c.Col.Add(new Collider { X = x, Z = z + 19, Hw = 2.5, Hd = 2.5, Rot = 0, H = 2 });
            for (int i = 0; i < 5; i++) Props.BuildProp(mb, x - 20 + i * 10, c.Y, z + 40, "stall", rng, 0);
        },
        ["town_square"] = c =>
        {
            // Wild West: water tower, gallows, flagpole, hitching rails, notice board, wagons
            var mb = c.Mb;
            double x = c.X, z = c.Z;
            var rng = c.Rng;
            mb.Material(Tile.WOOD, 0.6);
            foreach (var o in new[] { new double[] { -3, -3 }, new double[] { 3, -3 }, new double[] { 3, 3 }, new double[] { -3, 3 } })
                mb.Box(x + 22 + o[0], c.Y, z - 18 + o[1], 0.5, 12, 0.5, 0x5a4a3a);
            mb.Cylinder(x + 22, c.Y + 12, z - 18, 4, 4, 5, 0x7a5a3a, 10);
            mb.Cylinder(x + 22, c.Y + 17, z - 18, 4.4, 0, 2, 0x4a3a2a, 10);
            Solid(c, x + 22, z - 18, 7, 7, 19);
            // gallows
            mb.Box(x - 18, c.Y, z - 12, 8, 1.2, 6, 0x6a5a40);
            mb.Box(x - 21, c.Y + 1.2, z - 12, 0.4, 5, 0.4, 0x5a4a3a);
            mb.Box(x - 18.5, c.Y + 6, z - 12, 5.5, 0.4, 0.4, 0x5a4a3a);
            mb.Box(x - 16, c.Y + 4.2, z - 12, 0.08, 1.8, 0.08, 0x3a2a1a);
            Stair(c, x - 10.5, c.Y, z - 12, 3, 3.5, 1.2, -1, 0, 0x6a5a40);
            Platform(c, x - 18, z - 12, 8, 6, c.Y + 1.2);
            Column(c, x - 21, z - 12, 0.3, 6);
            // flagpole
            mb.Material(Tile.CONCRETE, 0.5);
            mb.Cylinder(x, c.Y, z, 0.15, 0.1, 12, 0xe8e0d0, 6);
            mb.Box(x + 1.8, c.Y + 10.2, z, 3.4, 2.2, 0.1, 0x3a4a8a);
            // hitching rails
            mb.Material(Tile.WOOD, 0.6);
            foreach (double oz in new double[] { -28, 28 })
            {
                for (int i = 0; i < 5; i++)
                {
                    mb.Box(x - 16 + i * 8, c.Y, z + oz, 0.25, 1.2, 0.25, 0x5a4a3a);
                }
                mb.Box(x, c.Y + 1.1, z + oz, 32, 0.15, 0.15, 0x5a4a3a);
            }
            // water trough and notice board
            mb.Box(x + 8, c.Y, z + 22, 3, 0.8, 1.0, 0x6a5a40);
            mb.Box(x + 8, c.Y + 0.7, z + 22, 2.8, 0.1, 0.8, 0x3a5a6a);
            mb.Box(x - 8, c.Y, z + 22, 0.2, 2.6, 0.2, 0x5a4a3a);
            mb.Box(x - 8, c.Y + 1.4, z + 22, 1.8, 1.1, 0.1, 0xd9c08a);
            for (int i = 0; i < 2; i++) Props.BuildProp(mb, x - 24 + i * 48, c.Y, z + 8, "wagon", rng, 0.3 + i);
            Props.BuildProp(mb, x + 24, c.Y, z + 20, "cactus", rng);
        },
        // ---------- markets ----------
        ["bazaar"] = c =>
        {
            for (int i = 0; i < 4; i++)
            {
                for (int j = 0; j < 3; j++)
                {
                    Props.BuildProp(c.Mb, c.X - 24 + i * 16, c.Y, c.Z - 16 + j * 16, "stall", c.Rng, (j % 2) * Math.PI);
                    c.Col.Add(new Collider { X = c.X - 24 + i * 16, Z = c.Z - 16 + j * 16, Hw = 1.5, Hd = 1.0, Rot = 0, H = 2 });
                }
            }
            Props.BuildProp(c.Mb, c.X + 30, c.Y, c.Z, "well", c.Rng);
            c.Col.Add(new Collider { X = c.X + 30, Z = c.Z, Hw = 1.3, Hd = 1.3, Rot = 0, H = 2 });
        },
        ["stoa_market"] = c =>
        {
            c.Mb.Box(c.X, c.Y - 1, c.Z - 20, 80, 1.6, 14, 0xf2ece0);
            Platform(c, c.X, c.Z - 20, 80, 14, c.Y + 0.6);
            for (int i = 0; i < 16; i++)
            {
                c.Mb.Cylinder(c.X - 37 + i * 5, c.Y + 0.5, c.Z - 14, 0.6, 0.5, 6, 0xf4efe4, 8);
                Column(c, c.X - 37 + i * 5, c.Z - 14, 0.6, 6.5);
            }
            c.Mb.Box(c.X, c.Y + 0.5, c.Z - 23, 80, 6, 8, 0xe7dfcb);
            c.Mb.Box(c.X, c.Y + 6.5, c.Z - 20, 82, 1, 16, 0xe8e0d0);
            c.Mb.Prism(c.X, c.Y + 7.5, c.Z - 20, 84, 3, 18, 0xb5533b);
            Solid(c, c.X, c.Z - 23, 80, 8, 8);
            for (int i = 0; i < 6; i++) Props.BuildProp(c.Mb, c.X - 30 + i * 12, c.Y, c.Z + 8, "stall", c.Rng, 0);
        },
        ["macellum"] = c =>
        {
            c.Mb.Cylinder(c.X, c.Y - 1, c.Z, 20, 20, 1.5, 0xd9d0bd, 16);
            RoundPlatform(c, c.X, c.Z, 20, c.Y + 0.5);
            for (int i = 0; i < 16; i++)
            {
                double a = (i / 16.0) * Math.PI * 2;
                c.Mb.Cylinder(c.X + Math.Cos(a) * 17, c.Y + 0.5, c.Z + Math.Sin(a) * 17, 0.6, 0.5, 6, 0xf0e8d8, 8);
                Column(c, c.X + Math.Cos(a) * 17, c.Z + Math.Sin(a) * 17, 0.6, 6.5);
            }
            c.Mb.Cylinder(c.X, c.Y + 6.5, c.Z, 19, 19, 1, 0xe8e0d0, 16);
            c.Mb.Cylinder(c.X, c.Y + 7.5, c.Z, 19, 6, 4, 0xb04f36, 16);
            c.Mb.Cylinder(c.X, c.Y + 0.5, c.Z, 6, 6, 8, 0xe8dabd, 10);
            c.Mb.Dome(c.X, c.Y + 8.5, c.Z, 6, 0xb04f36, 10, 3);
            Solid(c, c.X, c.Z, 12, 12, 10);
            for (int i = 0; i < 8; i++)
            {
                double a = (i / 8.0) * Math.PI * 2 + 0.2;
                Props.BuildProp(c.Mb, c.X + Math.Cos(a) * 12, c.Y + 0.5, c.Z + Math.Sin(a) * 12, "stall", c.Rng, a + Math.PI / 2);
            }
        },
        ["trading_post"] = c =>
        {
            c.Mb.Box(c.X, c.Y - 1, c.Z, 20, 5, 12, 0x6e5436);
            c.Mb.Prism(c.X, c.Y + 4, c.Z, 22, 5, 15, 0x8a7a4a);
            Solid(c, c.X, c.Z, 20, 12, 9, 0, "hall");
            for (int i = 0; i < 5; i++) Props.BuildProp(c.Mb, c.X - 20 + i * 10, c.Y, c.Z + 12, "stall", c.Rng, 0);
            for (int i = 0; i < 6; i++) Props.BuildProp(c.Mb, c.X - 15 + i * 6, c.Y, c.Z - 10, "barrel", c.Rng);
        },
        ["caravan"] = c =>
        {
            for (int i = 0; i < 6; i++)
            {
                double cx = c.X - 30 + i * 12;
                c.Mb.Box(cx, c.Y + 1.4, c.Z, 3, 1.4, 1.0, 0xc9a86a, 0.3);
                c.Mb.Dome(cx, c.Y + 2.6, c.Z, 0.9, 0xb89858, 6, 2);
                c.Mb.Box(cx + 1.8, c.Y + 1.8, c.Z, 1.0, 1.4, 0.6, 0xc9a86a, 0.3);
                foreach (var o in new[] { new[] { -1, -0.4 }, new[] { 1, -0.4 }, new[] { -1, 0.4 }, new[] { 1, 0.4 } })
                    c.Mb.Box(cx + o[0], c.Y, c.Z + o[1], 0.25, 1.4, 0.25, 0xb89858);
            }
            for (int i = 0; i < 4; i++) Props.BuildProp(c.Mb, c.X - 20 + i * 14, c.Y, c.Z + 16, "tent", c.Rng, c.Rng.Range(0, 3));
            for (int i = 0; i < 4; i++) Props.BuildProp(c.Mb, c.X - 20 + i * 14, c.Y, c.Z - 14, "stall", c.Rng, 0);
        },
        ["tlatelolco"] = c =>
        {
            c.Mb.GroundQuad(c.X - 50, c.Z - 40, c.X + 50, c.Z - 40, c.X + 50, c.Z + 40, c.X - 50, c.Z + 40, c.Y + 0.08, 0xd3c9ad);
            for (int i = 0; i < 6; i++)
            {
                for (int j = 0; j < 4; j++)
                {
                    Props.BuildProp(c.Mb, c.X - 40 + i * 16, c.Y, c.Z - 24 + j * 16, "stall", c.Rng, (j % 2) * Math.PI);
                    c.Col.Add(new Collider { X = c.X - 40 + i * 16, Z = c.Z - 24 + j * 16, Hw = 1.5, Hd = 1.0, Rot = 0, H = 2 });
                }
            }
            c.Mb.Box(c.X, c.Y, c.Z, 6, 3, 6, 0xf1ebdc);
            c.Mb.Box(c.X, c.Y + 3, c.Z, 4, 2, 4, 0xe9e0cc);
            Solid(c, c.X, c.Z, 6, 6, 5);
        },
        ["general_store"] = c =>
        {
            c.Mb.Box(c.X, c.Y - 1, c.Z, 16, 7, 12, 0xc9a070);
            c.Mb.Box(c.X, c.Y + 5, c.Z + 6.2, 17, 3.5, 0.5, 0xd9cfb5);
            c.Mb.Prism(c.X, c.Y + 6, c.Z, 16, 3, 13, 0x5a4a3a);
            c.Mb.Box(c.X, c.Y + 3, c.Z + 8, 18, 0.4, 4, 0x8a6a4a);
            foreach (int s in PM) c.Mb.Box(c.X + s * 8, c.Y, c.Z + 9.5, 0.3, 3.2, 0.3, 0x8a6a4a);
            Solid(c, c.X, c.Z, 16, 12, 9, 0, "store");
            for (int i = 0; i < 4; i++) Props.BuildProp(c.Mb, c.X - 12 + i * 8, c.Y, c.Z + 14, "barrel", c.Rng);
            Props.BuildProp(c.Mb, c.X + 20, c.Y, c.Z + 6, "wagon", c.Rng, 1.2);
        },
        ["covered_market"] = c =>
        {
            c.Mb.Box(c.X, c.Y - 1, c.Z, 60, 8, 36, 0x8a5a44);
            c.Mb.Prism(c.X, c.Y + 7, c.Z, 62, 6, 38, 0x9fd0e8);
            for (int i = 0; i < 11; i++) c.Mb.Box(c.X - 30 + i * 6, c.Y + 7, c.Z, 0.4, 6, 38.4, 0x3a3a3a);
            Solid(c, c.X, c.Z, 60, 36, 13, 0, "market");
            for (int i = 0; i < 5; i++) Props.BuildProp(c.Mb, c.X - 24 + i * 12, c.Y, c.Z + 24, "stall", c.Rng, 0);
        },
    };

    static readonly int[] HORSE_COLORS = { 0x5a4030, 0x8a7050, 0x2a2a2a };
    static readonly int[] CORRAL_COLORS = { 0x5a4030, 0x8a7050, 0xd8d0c0 };
    static readonly int[] OVOO_COLORS = { 0x2b6fb0, 0xe8e0d0, 0xd9a52a };

    public static List<Collider> BuildLandmark(MeshBuilder mb, string key, Site site, Era era, double groundY, Rng rng)
    {
        var col = new List<Collider>();
        if (key == null || !GENERATORS.TryGetValue(key, out var gen)) return col;
        mb.Material(LANDMARK_TILE.TryGetValue(key, out int tile) ? tile : Tile.STONE, 0.3);
        gen(new Ctx { Mb = mb, X = site.X, Z = site.Z, Y = groundY, Rng = rng, Era = era, Col = col });
        var result = new List<Collider>(col.Count);
        foreach (var k in col)
            if (k.Hw > 0 && k.Hd > 0) result.Add(k);
        return result;
    }

    /// <summary>The landmark key the era puts on a site, or null for none.</summary>
    public static string LandmarkKeyForSite(Era era, string siteId)
    {
        string k = era.Landmarks?.ForSite(siteId);
        return !string.IsNullOrEmpty(k) && k != "none" ? k : null;
    }
}
