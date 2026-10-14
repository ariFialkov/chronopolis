using System;
using System.Collections.Generic;

namespace Chronopolis;

public sealed class StripOptions
{
    public bool Lanes;
    /// <summary>minor street vs arterial look</summary>
    public bool Minor;
    /// <summary>render as a canal instead of a road (TS optional, default false)</summary>
    public bool Canal;
    /// <summary>extra height so crossing roads do not z-fight (metres; TS optional, default 0)</summary>
    public double Lift;
}

/// <summary>Port of src/world/roads.ts.</summary>
public static class Roads
{
    static readonly double[] FitSamples = { 0.25, 0.5, 0.75 };

    /// <summary>
    /// Draws a road along a polyline with optional lane markings.
    /// heightAt gives the ground height; the road sits a few cm above it.
    /// </summary>
    public static void BuildRoadStrip(MeshBuilder mb, IReadOnlyList<P2> pts, double width, Surfaces surf, Func<double, double, double> heightAt, StripOptions opt)
    {
        int roadTile = opt.Minor ? surf.MinorRoad : surf.Road;
        int roadColor = opt.Minor ? surf.MinorRoadColor : surf.RoadColor;
        for (int i = 0; i < pts.Count - 1; i++)
        {
            double ax = pts[i].X, az = pts[i].Z;
            double bx = pts[i + 1].X, bz = pts[i + 1].Z;
            double dx = bx - ax;
            double dz = bz - az;
            double len = M.Hypot(dx, dz);
            if (len < 0.01) continue;
            double ux = dx / len;
            double uz = dz / len;
            double nx = -uz;
            double nz = ux;
            double hw = width / 2;
            double lift = 0.07 + opt.Lift;
            // sample the ground at every corner so the road hugs slopes in both directions
            double H(double px, double pz) => heightAt(px, pz) + lift;
            double yaL = H(ax + nx * hw, az + nz * hw);
            double yaR = H(ax - nx * hw, az - nz * hw);
            double ybL = H(bx + nx * hw, bz + nz * hw);
            double ybR = H(bx - nx * hw, bz - nz * hw);
            double ya = (yaL + yaR) / 2;
            double yb = (ybL + ybR) / 2;
            if (opt.Canal)
            {
                // water channel: sunken bed with stone edges
                mb.Material(Tile.STONE, 0.5);
                mb.SetColor(M.Shade(surf.PlazaColor, 0.8));
                const double e = 0.7;
                // edges
                mb.Quad(ax + nx * hw, ya, az + nz * hw, bx + nx * hw, yb, bz + nz * hw, bx + nx * (hw - e), yb, bz + nz * (hw - e), ax + nx * (hw - e), ya, az + nz * (hw - e));
                mb.Quad(ax - nx * (hw - e), ya, az - nz * (hw - e), bx - nx * (hw - e), yb, bz - nz * (hw - e), bx - nx * hw, yb, bz - nz * hw, ax - nx * hw, ya, az - nz * hw);
                // inner walls down to the water
                const double depth = 1.2;
                mb.Quad(ax + nx * (hw - e), ya, az + nz * (hw - e), bx + nx * (hw - e), yb, bz + nz * (hw - e), bx + nx * (hw - e), yb - depth, bz + nz * (hw - e), ax + nx * (hw - e), ya - depth, az + nz * (hw - e));
                mb.Quad(ax - nx * (hw - e), ya - depth, az - nz * (hw - e), bx - nx * (hw - e), yb - depth, bz - nz * (hw - e), bx - nx * (hw - e), yb, bz - nz * (hw - e), ax - nx * (hw - e), ya, az - nz * (hw - e));
                // water surface
                mb.Material(Tile.ASPHALT, 0.2);
                mb.SetColor(0x3a8a8c);
                mb.Quad(ax + nx * (hw - e), ya - depth * 0.6, az + nz * (hw - e), bx + nx * (hw - e), yb - depth * 0.6, bz + nz * (hw - e), bx - nx * (hw - e), yb - depth * 0.6, bz - nz * (hw - e), ax - nx * (hw - e), ya - depth * 0.6, az - nz * (hw - e));
                continue;
            }
            mb.Material(roadTile, roadTile == Tile.COBBLE ? 0.6 : roadTile == Tile.SLAB ? 0.35 : 0.3);
            mb.SetColor(roadColor);
            // a grid of small quads (every ~2 m along, edges and centreline across) so the surface follows
            // the ground over crests and dips instead of cutting under them
            double[] across = { hw, 0, -hw };
            // as few subdivisions as keep the surface within a few cm of the ground (flat ground: one quad)
            bool Fits(int m)
            {
                foreach (double o in across)
                {
                    double ox = nx * o;
                    double oz = nz * o;
                    for (int k = 0; k < m; k++)
                    {
                        double y0 = H(ax + (bx - ax) * ((double)k / m) + ox, az + (bz - az) * ((double)k / m) + oz);
                        double y1 = H(ax + (bx - ax) * ((double)(k + 1) / m) + ox, az + (bz - az) * ((double)(k + 1) / m) + oz);
                        foreach (double f in FitSamples)
                        {
                            double t = (k + f) / m;
                            if (H(ax + (bx - ax) * t + ox, az + (bz - az) * t + oz) - (y0 + (y1 - y0) * f) > 0.03) return false;
                        }
                    }
                }
                return true;
            }
            int n = 1;
            while (n < Math.Ceiling(len / 1.5) && !Fits(n)) n *= 2;
            var prev = new double[across.Length];
            for (int q = 0; q < across.Length; q++) prev[q] = H(ax + nx * across[q], az + nz * across[q]);
            for (int k = 1; k <= n; k++)
            {
                double t0 = (double)(k - 1) / n;
                double t1 = (double)k / n;
                double px0 = ax + (bx - ax) * t0;
                double pz0 = az + (bz - az) * t0;
                double px1 = ax + (bx - ax) * t1;
                double pz1 = az + (bz - az) * t1;
                var cur = new double[across.Length];
                for (int q = 0; q < across.Length; q++) cur[q] = H(px1 + nx * across[q], pz1 + nz * across[q]);
                for (int j = 0; j < across.Length - 1; j++)
                {
                    double o0 = across[j];
                    double o1 = across[j + 1];
                    mb.Quad(px0 + nx * o0, prev[j], pz0 + nz * o0, px1 + nx * o0, cur[j], pz1 + nz * o0, px1 + nx * o1, cur[j + 1], pz1 + nz * o1, px0 + nx * o1, prev[j + 1], pz0 + nz * o1);
                }
                prev = cur;
            }

            if (opt.Lanes && surf.LaneMarks && !opt.Minor)
            {
                mb.Material(Tile.ASPHALT, 0.3);
                mb.SetColor(surf.LaneColor);
                // dashed centre line
                for (double t = 0; t < len; t += 6)
                {
                    double t1 = Math.Min(len, t + 3);
                    double x0 = ax + ux * t;
                    double z0 = az + uz * t;
                    double x1 = ax + ux * t1;
                    double z1 = az + uz * t1;
                    double y0 = H(x0, z0) + 0.012;
                    double y1 = H(x1, z1) + 0.012;
                    mb.Quad(x0 + nx * 0.1, y0, z0 + nz * 0.1, x1 + nx * 0.1, y1, z1 + nz * 0.1, x1 - nx * 0.1, y1, z1 - nz * 0.1, x0 - nx * 0.1, y0, z0 - nz * 0.1);
                }
            }
        }
    }
}
