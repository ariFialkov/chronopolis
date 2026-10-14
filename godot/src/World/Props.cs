using System;
using System.Collections.Generic;

namespace Chronopolis;

/// <summary>Trees and street props (port of props.ts).</summary>
public static class Props
{
    const int TRUNK = 0x5a4330;

    /// <summary>Returns collision radius (0 = walk-through).</summary>
    public static double BuildTree(MeshBuilder mb, double x, double y, double z, string kind, Rng rng)
    {
        double s = rng.Range(0.8, 1.3);
        mb.Material(Tile.WOOD, 0.8);
        switch (kind)
        {
            case "oak":
            {
                int g = M.Shade(0x4f7f3a, rng.Range(0.85, 1.15));
                mb.Cylinder(x, y - 0.3, z, 0.35 * s, 0.25 * s, 2.6 * s, TRUNK, 6);
                mb.Material(Tile.GRASS, 0.35);
                mb.Dome(x, y + 1.8 * s, z, 2.4 * s, g, 8, 3);
                mb.Dome(x + 0.8 * s, y + 2.6 * s, z - 0.4 * s, 1.6 * s, M.Shade(g, 1.1), 7, 3);
                return 0.45;
            }
            case "pine":
            {
                int g = M.Shade(0x2f5f36, rng.Range(0.85, 1.15));
                mb.Cylinder(x, y - 0.3, z, 0.3 * s, 0.2 * s, 2 * s, TRUNK, 5);
                mb.Material(Tile.GRASS, 0.35);
                mb.Cylinder(x, y + 1.2 * s, z, 2.2 * s, 0.0, 3.2 * s, g, 7);
                mb.Cylinder(x, y + 3.2 * s, z, 1.6 * s, 0.0, 2.8 * s, M.Shade(g, 1.08), 7);
                mb.Cylinder(x, y + 5.0 * s, z, 1.0 * s, 0.0, 2.2 * s, M.Shade(g, 1.15), 7);
                return 0.4;
            }
            case "cedar":
            {
                int g = M.Shade(0x3b6a3f, rng.Range(0.85, 1.15));
                mb.Cylinder(x, y - 0.3, z, 0.45 * s, 0.3 * s, 3 * s, TRUNK, 6);
                mb.Material(Tile.GRASS, 0.35);
                mb.Cylinder(x, y + 1.5 * s, z, 3.2 * s, 1.5 * s, 2.5 * s, g, 8);
                mb.Cylinder(x, y + 3.8 * s, z, 2.4 * s, 0.0, 2.6 * s, M.Shade(g, 1.1), 8);
                return 0.5;
            }
            case "cypress":
            {
                int g = M.Shade(0x2d5a33, rng.Range(0.85, 1.15));
                mb.Cylinder(x, y - 0.3, z, 0.25 * s, 0.2 * s, 1.2 * s, TRUNK, 5);
                mb.Material(Tile.GRASS, 0.35);
                mb.Cylinder(x, y + 0.8 * s, z, 0.9 * s, 0.0, 6.5 * s, g, 6);
                return 0.35;
            }
            case "palm":
            {
                double lean = rng.Range(-0.25, 0.25);
                double h = 6 * s;
                double tx = x + lean * h;
                mb.Cylinder(x, y - 0.3, z, 0.3 * s, 0.22 * s, h, 0x8a6a45, 5);
                mb.Material(Tile.GRASS, 0.35);
                int g = M.Shade(0x4f8f3a, rng.Range(0.85, 1.15));
                for (int i = 0; i < 6; i++)
                {
                    double a = (i / 6.0) * Math.PI * 2 + rng.Range(0, 0.5);
                    mb.Prism(tx + Math.Cos(a) * 1.4 * s, y + h - 0.4, z + Math.Sin(a) * 1.4 * s, 3 * s, 0.4, 0.9 * s, g, a);
                }
                mb.Dome(tx, y + h - 0.6, z, 0.7 * s, 0x7a5a3a, 6, 2);
                return 0.35;
            }
            case "jungle":
            {
                int g = M.Shade(0x2f7a3a, rng.Range(0.8, 1.2));
                double h = 7 * s;
                mb.Cylinder(x, y - 0.3, z, 0.5 * s, 0.35 * s, h, 0x6a5038, 6);
                mb.Material(Tile.GRASS, 0.35);
                mb.Dome(x, y + h - 1, z, 3.4 * s, g, 9, 3);
                mb.Dome(x + 1.5 * s, y + h - 2.2, z + 1 * s, 2.2 * s, M.Shade(g, 0.9), 7, 2);
                mb.Dome(x - 1.4 * s, y + h - 2.4, z - 1.2 * s, 2.0 * s, M.Shade(g, 1.1), 7, 2);
                return 0.55;
            }
            case "dead":
            {
                mb.Cylinder(x, y - 0.3, z, 0.3 * s, 0.15 * s, 3.5 * s, 0x6a5a4a, 5);
                mb.Material(Tile.GRASS, 0.35);
                mb.Box(x + 0.6 * s, y + 2.4 * s, z, 1.8 * s, 0.25, 0.25, 0x6a5a4a, 0.6);
                mb.Box(x - 0.5 * s, y + 2.9 * s, z + 0.2, 1.4 * s, 0.22, 0.22, 0x6a5a4a, -0.9);
                return 0.3;
            }
            case "none":
                return 0;
        }
        return 0;
    }

    static readonly Dictionary<string, int> PROP_TILE = new()
    {
        ["statue"] = Tile.STONE, ["obelisk"] = Tile.STONE, ["pillar"] = Tile.STONE, ["stele"] = Tile.STONE, ["runestone"] = Tile.STONE, ["well"] = Tile.STONE,
        ["fountain"] = Tile.STONE, ["altar"] = Tile.STONE, ["shrine"] = Tile.STONE, ["boulder"] = Tile.STONE, ["lamp"] = Tile.CONCRETE, ["gaslamp"] = Tile.CONCRETE,
        ["hydrant"] = Tile.CONCRETE, ["automobile"] = Tile.CONCRETE, ["cannon"] = Tile.CONCRETE, ["amphora"] = Tile.MUDBRICK, ["haystack"] = Tile.THATCH,
        ["tent"] = Tile.THATCH, ["cactus"] = Tile.GRASS, ["campfire"] = Tile.STONE,
    };

    static readonly int[] CAR_COLORS = { 0x1a1a1a, 0x2a2a3a, 0x4a1a1a, 0x1a3a2a, 0x3a3a3a };
    static readonly int[] STALL_CLOTHS = { 0xc83a2a, 0x2a6ab0, 0xd9a52a, 0x4a8a3a, 0xe8e0d0 };
    static readonly int[] SIDES = { -1, 1 };

    /// <summary>Builds a prop and returns its collision radius (0 = walk-through).</summary>
    public static double BuildProp(MeshBuilder mb, double x, double y, double z, string kind, Rng rng, double rot = 0)
    {
        mb.Material(PROP_TILE.TryGetValue(kind, out int tile) ? tile : Tile.WOOD, 0.6);
        switch (kind)
        {
            case "lamp":
                mb.Cylinder(x, y, z, 0.12, 0.1, 4.2, 0x3a3a3a, 5);
                mb.Box(x, y + 4.2, z, 0.5, 0.45, 0.5, 0xfff0b0);
                return 0.2;
            case "gaslamp":
                mb.Cylinder(x, y, z, 0.14, 0.1, 3.4, 0x2a3a2a, 5);
                mb.Hip(x, y + 3.4, z, 0.6, 0.6, 0.6, 0.4, 0.4, 0xffe8a0);
                mb.Hip(x, y + 4.0, z, 0.6, 0.3, 0.6, 0, 0, 0x2a3a2a);
                return 0.2;
            case "torch":
                mb.Cylinder(x, y, z, 0.1, 0.08, 2.4, 0x5a4330, 5);
                mb.Cylinder(x, y + 2.4, z, 0.25, 0.05, 0.7, 0xffa030, 5);
                return 0.15;
            case "lantern":
                mb.Box(x, y, z, 0.7, 0.3, 0.7, 0x7a7a72, rot);
                mb.Cylinder(x, y + 0.3, z, 0.18, 0.18, 1.6, 0x7a7a72, 6);
                mb.Box(x, y + 1.9, z, 0.7, 0.5, 0.7, 0x7a7a72, rot);
                mb.Hip(x, y + 2.4, z, 1.0, 0.4, 1.0, 0, 0, 0x6a6a62, rot);
                return 0.4;
            case "crate":
                mb.Box(x, y, z, 1.1, 1.1, 1.1, M.Shade(0x9a7a4a, rng.Range(0.85, 1.1)), rot);
                if (rng.Chance(0.4)) mb.Box(x + 0.3, y + 1.1, z - 0.2, 0.9, 0.9, 0.9, 0x8a6a40, rot + 0.4);
                return 0.7;
            case "barrel":
                mb.Cylinder(x, y, z, 0.5, 0.5, 1.1, M.Shade(0x7a5a3a, rng.Range(0.85, 1.1)), 7);
                mb.Cylinder(x, y + 0.3, z, 0.53, 0.53, 0.12, 0x3a3a3a, 7);
                mb.Cylinder(x, y + 0.75, z, 0.53, 0.53, 0.12, 0x3a3a3a, 7);
                return 0.55;
            case "amphora":
                mb.Cylinder(x, y, z, 0.25, 0.45, 0.7, 0xb0704a, 6);
                mb.Cylinder(x, y + 0.7, z, 0.45, 0.2, 0.6, 0xb0704a, 6);
                return 0.4;
            case "statue":
                mb.Box(x, y, z, 1.4, 1.2, 1.4, 0xb8b0a0, rot);
                mb.Box(x, y + 1.2, z, 0.5, 1.4, 0.4, 0xd0c8b8, rot);
                mb.Box(x, y + 2.6, z, 0.9, 0.8, 0.45, 0xd0c8b8, rot);
                mb.Dome(x, y + 3.4, z, 0.3, 0xd0c8b8, 6, 2);
                return 0.8;
            case "obelisk":
                mb.Box(x, y, z, 1.6, 0.6, 1.6, 0xd8c8a8, rot);
                mb.Hip(x, y + 0.6, z, 1.2, 7, 1.2, 0.5, 0.5, 0xe0d0b0, rot);
                mb.Hip(x, y + 7.6, z, 0.5, 0.6, 0.5, 0, 0, 0xf0d070, rot);
                return 0.9;
            case "pillar":
                mb.Cylinder(x, y, z, 0.6, 0.5, 6, 0xe8e0d0, 8);
                mb.Box(x, y + 6, z, 1.4, 0.5, 1.4, 0xe8e0d0, rot);
                return 0.7;
            case "stele":
                mb.Box(x, y, z, 1.2, 3.2, 0.5, 0xb8a888, rot);
                mb.Box(x, y, z, 1.8, 0.4, 1.0, 0xa89878, rot);
                return 0.8;
            case "runestone":
                mb.Hip(x, y - 0.2, z, 1.4, 2.4, 0.7, 0.9, 0.5, 0x7a7a78, rot);
                return 0.7;
            case "totem":
                mb.Cylinder(x, y, z, 0.3, 0.3, 4, 0x6a4a2a, 6);
                mb.Box(x, y + 1.2, z, 0.9, 0.8, 0.8, 0x8a3a2a, rot);
                mb.Box(x, y + 2.6, z, 0.9, 0.8, 0.8, 0x2a5a8a, rot);
                mb.Box(x, y + 4, z, 1.6, 0.3, 0.4, 0x6a4a2a, rot);
                return 0.4;
            case "well":
                mb.Cylinder(x, y, z, 1.2, 1.2, 1.0, 0x8a8a80, 8);
                mb.Cylinder(x, y + 0.9, z, 0.9, 0.9, 0.2, 0x2a3a4a, 8);
                mb.Box(x - 1, y, z, 0.2, 2.6, 0.2, 0x5a4330);
                mb.Box(x + 1, y, z, 0.2, 2.6, 0.2, 0x5a4330);
                mb.Prism(x, y + 2.6, z, 2.8, 0.6, 1.6, 0x6a4a3a);
                return 1.3;
            case "fountain":
                mb.Cylinder(x, y, z, 2.4, 2.4, 0.7, 0xc8c0b0, 10);
                mb.Cylinder(x, y + 0.5, z, 2.0, 2.0, 0.25, 0x4a8aa8, 10);
                mb.Cylinder(x, y + 0.7, z, 0.4, 0.3, 1.6, 0xc8c0b0, 6);
                mb.Cylinder(x, y + 2.3, z, 1.0, 1.0, 0.3, 0xc8c0b0, 8);
                return 2.5;
            case "cart":
                mb.Box(x, y + 0.6, z, 2.6, 0.7, 1.4, 0x8a6a40, rot);
                mb.Cylinder(x + Math.Cos(rot) * 0.8, y + 0.0, z + Math.Sin(rot) * 0.8, 0.55, 0.55, 0.15, 0x4a3a2a, 8);
                mb.Cylinder(x - Math.Cos(rot) * 0.8, y + 0.0, z - Math.Sin(rot) * 0.8, 0.55, 0.55, 0.15, 0x4a3a2a, 8);
                return 1.3;
            case "wagon":
                mb.Box(x, y + 0.7, z, 3.4, 0.8, 1.6, 0x7a5a3a, rot);
                mb.Hip(x, y + 1.5, z, 3.4, 0.9, 1.9, 3.0, 1.4, 0xe8e0d0, rot);
                foreach (int s in SIDES)
                {
                    mb.Cylinder(x + Math.Cos(rot) * 1.1 * s + Math.Sin(rot) * 0.8, y, z + Math.Sin(rot) * 1.1 * s - Math.Cos(rot) * 0.8, 0.6, 0.6, 0.15, 0x4a3a2a, 8);
                    mb.Cylinder(x + Math.Cos(rot) * 1.1 * s - Math.Sin(rot) * 0.8, y, z + Math.Sin(rot) * 1.1 * s + Math.Cos(rot) * 0.8, 0.6, 0.6, 0.15, 0x4a3a2a, 8);
                }
                return 1.8;
            case "automobile":
            {
                int c = rng.Pick(CAR_COLORS);
                mb.Box(x, y + 0.45, z, 4.4, 0.8, 1.8, c, rot);
                mb.Box(x - Math.Cos(rot) * 0.3, y + 1.25, z - Math.Sin(rot) * 0.3, 2.4, 0.9, 1.6, c, rot);
                foreach (int s in SIDES)
                {
                    mb.Cylinder(x + Math.Cos(rot) * 1.4 * s + Math.Sin(rot) * 0.9, y, z + Math.Sin(rot) * 1.4 * s - Math.Cos(rot) * 0.9, 0.42, 0.42, 0.25, 0x111111, 8);
                    mb.Cylinder(x + Math.Cos(rot) * 1.4 * s - Math.Sin(rot) * 0.9, y, z + Math.Sin(rot) * 1.4 * s + Math.Cos(rot) * 0.9, 0.42, 0.42, 0.25, 0x111111, 8);
                }
                return 2.2;
            }
            case "bench":
                mb.Box(x, y + 0.45, z, 1.8, 0.1, 0.5, 0x6a4a3a, rot);
                mb.Box(x, y, z, 1.6, 0.45, 0.1, 0x3a3a3a, rot);
                return 0.6;
            case "hydrant":
                mb.Cylinder(x, y, z, 0.2, 0.18, 0.9, 0xb02020, 6);
                mb.Dome(x, y + 0.9, z, 0.2, 0xb02020, 6, 2);
                return 0.25;
            case "signpost":
                mb.Cylinder(x, y, z, 0.08, 0.08, 2.8, 0x5a4330, 5);
                mb.Box(x, y + 2.3, z, 1.2, 0.35, 0.08, 0xd8c8a0, rot);
                return 0.15;
            case "shrine":
                mb.Box(x, y, z, 1.6, 0.4, 1.6, 0x8a8a80, rot);
                mb.Box(x, y + 0.4, z, 1.0, 1.2, 1.0, 0x9a6a3a, rot);
                mb.Hip(x, y + 1.6, z, 1.8, 0.7, 1.8, 0, 0, 0x4a3a2a, rot);
                return 0.9;
            case "altar":
                mb.Box(x, y, z, 2.2, 1.0, 1.2, 0x9a9088, rot);
                mb.Box(x, y + 1.0, z, 2.5, 0.2, 1.5, 0xa8a098, rot);
                return 1.3;
            case "stall":
            {
                int cloth = rng.Pick(STALL_CLOTHS);
                mb.Box(x, y + 0.5, z, 2.6, 0.5, 1.4, 0x8a6a40, rot);
                foreach (int s in SIDES)
                {
                    mb.Box(x + Math.Cos(rot) * 1.2 * s, y, z + Math.Sin(rot) * 1.2 * s, 0.12, 2.3, 0.12, 0x5a4330);
                    mb.Box(x + Math.Cos(rot) * 1.2 * s - Math.Sin(rot) * 1.3, y, z + Math.Sin(rot) * 1.2 * s + Math.Cos(rot) * 1.3, 0.12, 2.3, 0.12, 0x5a4330);
                }
                mb.Prism(x - Math.Sin(rot) * 0.6, y + 2.3, z + Math.Cos(rot) * 0.6, 3.0, 0.5, 2.8, cloth, rot);
                return 1.5;
            }
            case "haystack":
                mb.Cylinder(x, y, z, 1.4, 0.4, 2.0, 0xd9b85a, 7);
                return 1.2;
            case "cactus":
                mb.Cylinder(x, y, z, 0.3, 0.28, 2.6, 0x4a7a3a, 6);
                mb.Box(x + 0.6, y + 1.2, z, 0.9, 0.3, 0.3, 0x4a7a3a);
                mb.Cylinder(x + 0.9, y + 1.2, z, 0.18, 0.16, 1.0, 0x4a7a3a, 5);
                return 0.4;
            case "campfire":
                for (int i = 0; i < 6; i++)
                {
                    double a = (i / 6.0) * Math.PI * 2;
                    mb.Box(x + Math.Cos(a) * 0.9, y, z + Math.Sin(a) * 0.9, 0.5, 0.35, 0.5, 0x6a6a68, a);
                }
                mb.Cylinder(x, y, z, 0.5, 0.05, 0.9, 0xff8020, 6);
                return 1.0;
            case "tent":
                mb.Hip(x, y - 0.1, z, 3.2, 2.2, 3.2, 0, 0, M.Shade(0xc9b890, rng.Range(0.85, 1.1)), rot);
                return 1.7;
            case "cannon":
                mb.Box(x, y + 0.3, z, 1.6, 0.5, 1.2, 0x6a4a3a, rot);
                mb.Cylinder(x, y + 0.6, z, 0.3, 0.3, 0.1, 0x2a2a2a, 6);
                mb.Box(x, y + 0.6, z, 2.6, 0.5, 0.5, 0x2a2a2a, rot);
                return 1.2;
            case "boulder":
            {
                // argument order matters for the rng: radius first, then the shade
                double r = rng.Range(0.8, 1.8);
                int col = M.Shade(0x8a8a80, rng.Range(0.8, 1.1));
                mb.Dome(x, y - 0.3, z, r, col, 6, 2);
                return 1.2;
            }
        }
        return 0;
    }
}
