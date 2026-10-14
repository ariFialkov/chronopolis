using System;
using System.Collections.Generic;

namespace Chronopolis;

/// <summary>
/// Era-specific street patterns laid over the constant macro layout.
/// A pattern answers two questions: "is this point on a minor street?" and
/// "which building lots exist inside this rectangle?". Both are pure functions of
/// position, so chunks can be generated in any order and are always identical.
/// (Port of src/world/pattern.ts.)
/// </summary>
public static class Pattern
{
    /// <summary>How "urban" a point is, 0..1. The city thins out toward the ring road.</summary>
    public static double Urbanity(Era era, double x, double z)
    {
        double r = Math.Max(Math.Abs(x), Math.Abs(z)) / Macro.RING_ROAD;
        double ext = era.Layout.Extent;
        double u = 1 - M.Smoothstep(ext * 0.8, Math.Max(ext, 1.0), r);
        // the citadel plateau is reserved for the landmark
        double dh = M.Hypot(x - Macro.HILL.X, z - Macro.HILL.Z);
        if (dh < Macro.HILL.Plateau + 20) u *= M.Smoothstep(Macro.HILL.Plateau - 10, Macro.HILL.Plateau + 20, dh);
        return u;
    }

    public static ICityPattern MakePattern(Era era, double parkChance = 0)
    {
        // TS: ERA_SEEDS[era.id] is undefined (-> NaN seed) for an unknown era; mirror that.
        double eraSeed = ERA_SEEDS.TryGetValue(era.Id ?? "", out int s) ? s : double.NaN;
        double seed = 1000 + eraSeed;
        if (era.Layout.Pattern == "radial") return new RadialPattern(era, seed);
        return new GridPattern(era, seed, parkChance);
    }

    static readonly Dictionary<string, int> ERA_SEEDS = new()
    {
        ["sumerian"] = 1, ["egyptian"] = 2, ["minoan"] = 3, ["mycenaean"] = 4, ["assyrian"] = 5, ["greek"] = 6, ["mauryan"] = 7, ["roman"] = 8, ["mayan"] = 9,
        ["viking"] = 10, ["khmer"] = 11, ["mongol"] = 12, ["aztec"] = 13, ["sengoku"] = 14, ["buccaneer"] = 15, ["wildwest"] = 16, ["victorian"] = 17, ["industrial"] = 18,
    };

    /// <summary>Grid-based patterns (grid, organic, spread, castle): streets are swaying lines on a block lattice.</summary>
    sealed class GridPattern : ICityPattern
    {
        readonly Era era;
        readonly EraLayout L;
        readonly double seed;
        readonly double parkChance;
        readonly double bw, bd, sw;
        readonly bool organic;
        readonly double skipStreet, skipSegment;

        public GridPattern(Era era, double seed, double parkChance)
        {
            this.era = era;
            this.seed = seed;
            this.parkChance = parkChance;
            L = era.Layout;
            bw = L.BlockW;
            bd = L.BlockD;
            sw = L.StreetWidth;
            organic = L.Pattern == "organic" || L.Pattern == "spread" || L.Pattern == "castle";
            skipStreet = L.Pattern == "spread" ? 0.45 : L.Pattern == "organic" ? 0.12 : 0;
            skipSegment = L.Pattern == "castle" ? 0.08 : L.Pattern == "spread" ? 0.12 : 0;
        }

        bool IsParkBlock(int i, int j) =>
            parkChance > 0 && Hash.Hash2(i * 7 + 3, j * 11 + 5, seed + 777) < parkChance && Urbanity(era, (i + 0.5) * bw, (j + 0.5) * bd) > 0.55;

        bool VExists(int i) => Hash.Hash2(i, 77, seed) >= skipStreet;
        bool HExists(int j) => Hash.Hash2(991, j, seed) >= skipStreet;
        bool VSegExists(int i, int j) => VExists(i) && Hash.Hash2(i * 3 + 1, j * 5 + 2, seed + 11) >= skipSegment;
        bool HSegExists(int i, int j) => HExists(j) && Hash.Hash2(i * 7 + 3, j * 11 + 5, seed + 23) >= skipSegment;

        // curvature: vertical street i sways in x as a function of z
        // (TS has an `organic ? a : b` with identical branches; kept as a single expression)
        double CurveV(int i, double z) => (Hash.Noise2(z / L.CurveLen, i * 3.1, seed + 5) - 0.5) * 2 * L.Curve;
        double CurveH(int j, double x) => (Hash.Noise2(x / L.CurveLen, j * 2.7 + 50, seed + 9) - 0.5) * 2 * L.Curve;
        double StreetX(int i, double z) => i * bw + CurveV(i, z);
        double StreetZ(int j, double x) => j * bd + CurveH(j, x);
        double WidthV(int i) => sw * (0.8 + 0.5 * Hash.Hash2(i, 5, seed));
        double WidthH(int j) => sw * (0.8 + 0.5 * Hash.Hash2(6, j, seed));

        public bool IsStreet(double x, double z)
        {
            int i = (int)M.Round(x / bw);
            int j = (int)M.Round(z / bd);
            // which block row/column are we in (for segment existence)
            int jj = (int)Math.Floor(z / bd);
            int ii = (int)Math.Floor(x / bw);
            if (VSegExists(i, jj) && Math.Abs(x - StreetX(i, z)) < WidthV(i) / 2) return true;
            if (HSegExists(ii, j) && Math.Abs(z - StreetZ(j, x)) < WidthH(j) / 2) return true;
            return false;
        }

        (double xl, double zt, double xr, double zb) BlockInner(int i, int j)
        {
            double zc = (j + 0.5) * bd;
            double xc = (i + 0.5) * bw;
            double xl = StreetX(i, zc) + WidthV(i) / 2;
            double xr = StreetX(i + 1, zc) - WidthV(i + 1) / 2;
            double zt = StreetZ(j, xc) + WidthH(j) / 2;
            double zb = StreetZ(j + 1, xc) - WidthH(j + 1) / 2;
            return (xl, zt, xr, zb);
        }

        public List<Park> ParksInRect(double x0, double z0, double x1, double z1)
        {
            var output = new List<Park>();
            int iEnd = (int)Math.Floor(x1 / bw) + 1;
            int jEnd = (int)Math.Floor(z1 / bd) + 1;
            for (int i = (int)Math.Floor(x0 / bw) - 1; i <= iEnd; i++)
            {
                for (int j = (int)Math.Floor(z0 / bd) - 1; j <= jEnd; j++)
                {
                    if (!IsParkBlock(i, j)) continue;
                    var (xl, zt, xr, zb) = BlockInner(i, j);
                    double x = (xl + xr) / 2;
                    double z = (zt + zb) / 2;
                    if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
                    output.Add(new Park { X = x, Z = z, W = xr - xl, D = zb - zt, Seed = Hash.Hash2(i, j, seed + 55) * 1e6 });
                }
            }
            return output;
        }

        public bool IsPark(double x, double z)
        {
            int i = (int)Math.Floor(x / bw);
            int j = (int)Math.Floor(z / bd);
            if (!IsParkBlock(i, j)) return false;
            var (xl, zt, xr, zb) = BlockInner(i, j);
            return x >= xl && x <= xr && z >= zt && z <= zb;
        }

        void LotsInBlock(int i, int j, List<Lot> output)
        {
            // block spans street i..i+1 and j..j+1
            if (IsParkBlock(i, j)) return;
            double blockSeed = Hash.Hash2(i, j, seed + 101) * 1e6;
            double zc = (j + 0.5) * bd;
            double xc = (i + 0.5) * bw;
            double xl = StreetX(i, zc) + WidthV(i) / 2;
            double xr = StreetX(i + 1, zc) - WidthV(i + 1) / 2;
            double zt = StreetZ(j, xc) + WidthH(j) / 2;
            double zb = StreetZ(j + 1, xc) - WidthH(j + 1) / 2;
            double innerW = xr - xl;
            double innerD = zb - zt;
            if (innerW < 4 || innerD < 4) return;

            if (L.Pattern == "spread")
            {
                // a few big plots, buildings placed freely with random rotation
                int n = 1 + (int)Math.Floor(Hash.Hash2(i, j, seed + 7) * 3);
                var placed = new List<Lot>();
                for (int k = 0; k < n; k++)
                {
                    double w = Math.Min(L.LotSize, innerW * 0.5);
                    double d = Math.Min(L.LotSize * 0.6, innerD * 0.5);
                    double r = M.Hypot(w, d) / 2 + 1.5; // rotated footprint radius plus a gap
                    bool ok = false;
                    double x = 0;
                    double z = 0;
                    double rot = 0;
                    for (int attempt = 0; attempt < 6 && !ok; attempt++)
                    {
                        double h = Hash.Hash2(i * 13 + k * 3 + attempt, j * 17 + k, seed + 31);
                        double h2 = Hash.Hash2(i * 19 + k, j * 23 + k * 5 + attempt, seed + 37);
                        x = xl + r + h * Math.Max(0, innerW - 2 * r);
                        z = zt + r + h2 * Math.Max(0, innerD - 2 * r);
                        rot = (Hash.Hash2(i + k, j - k + attempt, seed + 41) - 0.5) * 1.2;
                        ok = true;
                        foreach (var o in placed)
                        {
                            if (!(M.Hypot(o.X - x, o.Z - z) > 2 * r)) { ok = false; break; }
                        }
                    }
                    if (!ok) continue;
                    var lot = new Lot { X = x, Z = z, W = w, D = d, Rot = rot, Front = rot + Math.PI / 2, Seed = blockSeed + k * 7919, Weight = 1 };
                    placed.Add(lot);
                    output.Add(lot);
                }
                return;
            }

            int nx = Math.Max(1, (int)Math.Floor(innerW / L.LotSize));
            int nz = Math.Max(1, (int)Math.Floor(innerD / L.LotSize));
            double lw = innerW / nx;
            double ld = innerD / nz;
            for (int a = 0; a < nx; a++)
            {
                for (int b = 0; b < nz; b++)
                {
                    bool edgeL = a == 0;
                    bool edgeR = a == nx - 1;
                    bool edgeT = b == 0;
                    bool edgeB = b == nz - 1;
                    bool onEdge = edgeL || edgeR || edgeT || edgeB;
                    if (!onEdge && Hash.Hash2(a + i * 50, b + j * 50, seed + 61) < 0.75) continue; // interior stays open (courtyards)
                    double gx = xl + (a + 0.5) * lw;
                    double gz = zt + (b + 0.5) * ld;
                    // local curvature: follow the nearest street's sway, and turn the lot to the street's tangent
                    double x = gx + (edgeL ? CurveV(i, gz) - CurveV(i, zc) : edgeR ? CurveV(i + 1, gz) - CurveV(i + 1, zc) : 0);
                    double z = gz + (edgeT ? CurveH(j, gx) - CurveH(j, xc) : edgeB ? CurveH(j + 1, gx) - CurveH(j + 1, xc) : 0);
                    double lotRot = 0;
                    double lotW = lw;
                    double lotD = ld;
                    if (edgeL || edgeR)
                    {
                        int si = edgeL ? i : i + 1;
                        double slope = (CurveV(si, gz + 2) - CurveV(si, gz - 2)) / 4;
                        lotRot = -Math.Atan(slope);
                        lotD = Math.Max(4, ld - Math.Abs(slope) * lw);
                    }
                    else if (edgeT || edgeB)
                    {
                        int sj = edgeT ? j : j + 1;
                        double slope = (CurveH(sj, gx + 2) - CurveH(sj, gx - 2)) / 4;
                        lotRot = Math.Atan(slope);
                        lotW = Math.Max(4, lw - Math.Abs(slope) * ld);
                    }
                    double front;
                    if (edgeT) front = -Math.PI / 2;
                    else if (edgeB) front = Math.PI / 2;
                    else if (edgeL) front = Math.PI;
                    else front = 0;
                    if (edgeL && (edgeT || edgeB) && Hash.Hash2(a, b, seed + i + j) < 0.5) front = Math.PI;
                    if (edgeR && (edgeT || edgeB) && Hash.Hash2(a, b, seed + i - j) < 0.5) front = 0;
                    output.Add(new Lot { X = x, Z = z, W = lotW, D = lotD, Rot = lotRot, Front = front + lotRot, Seed = blockSeed + a * 131 + b * 977, Weight = onEdge ? 1 : 0.6 });
                }
            }
        }

        public List<Lot> LotsInRect(double x0, double z0, double x1, double z1)
        {
            var output = new List<Lot>();
            int i0 = (int)Math.Floor(x0 / bw) - 1;
            int i1 = (int)Math.Floor(x1 / bw) + 1;
            int j0 = (int)Math.Floor(z0 / bd) - 1;
            int j1 = (int)Math.Floor(z1 / bd) + 1;
            var tmp = new List<Lot>();
            for (int i = i0; i <= i1; i++)
            {
                for (int j = j0; j <= j1; j++)
                {
                    tmp.Clear();
                    LotsInBlock(i, j, tmp);
                    foreach (var l in tmp) if (l.X >= x0 && l.X < x1 && l.Z >= z0 && l.Z < z1) output.Add(l);
                }
            }
            return output;
        }

        public List<Strip> StripsInRect(double x0, double z0, double x1, double z1)
        {
            var strips = new List<Strip>();
            const double step = 8;
            int i0 = (int)Math.Ceiling((x0 - L.Curve - sw) / bw);
            int i1 = (int)Math.Floor((x1 + L.Curve + sw) / bw);
            for (int i = i0; i <= i1; i++)
            {
                if (!VExists(i)) continue;
                var cur = new List<P2>();
                for (double z = z0 - step; z <= z1 + step; z += step)
                {
                    int jj = (int)Math.Floor(z / bd);
                    if (VSegExists(i, jj))
                    {
                        cur.Add(new P2(StreetX(i, z), z));
                    }
                    else if (cur.Count > 0)
                    {
                        strips.Add(new Strip { Points = cur, Width = WidthV(i), Layer = 1 });
                        cur = new List<P2>();
                    }
                }
                if (cur.Count > 1) strips.Add(new Strip { Points = cur, Width = WidthV(i), Layer = 1 });
            }
            int j0 = (int)Math.Ceiling((z0 - L.Curve - sw) / bd);
            int j1 = (int)Math.Floor((z1 + L.Curve + sw) / bd);
            for (int j = j0; j <= j1; j++)
            {
                if (!HExists(j)) continue;
                var cur = new List<P2>();
                for (double x = x0 - step; x <= x1 + step; x += step)
                {
                    int ii = (int)Math.Floor(x / bw);
                    if (HSegExists(ii, j))
                    {
                        cur.Add(new P2(x, StreetZ(j, x)));
                    }
                    else if (cur.Count > 0)
                    {
                        strips.Add(new Strip { Points = cur, Width = WidthH(j), Layer = 0 });
                        cur = new List<P2>();
                    }
                }
                if (cur.Count > 1) strips.Add(new Strip { Points = cur, Width = WidthH(j), Layer = 0 });
            }
            return strips;
        }

        StreetNode Node(int i, int j)
        {
            double z = j * bd;
            double x = StreetX(i, z);
            return new StreetNode { X = x, Z = StreetZ(j, x), Key = $"{i},{j}" };
        }

        public List<StreetNode> NodesInRect(double x0, double z0, double x1, double z1)
        {
            var output = new List<StreetNode>();
            int iEnd = (int)Math.Ceiling(x1 / bw);
            int jEnd = (int)Math.Ceiling(z1 / bd);
            for (int i = (int)Math.Floor(x0 / bw); i <= iEnd; i++)
            {
                for (int j = (int)Math.Floor(z0 / bd); j <= jEnd; j++)
                {
                    if (!VExists(i) || !HExists(j)) continue;
                    var n = Node(i, j);
                    if (n.X >= x0 && n.X < x1 && n.Z >= z0 && n.Z < z1) output.Add(n);
                }
            }
            return output;
        }

        public List<StreetNode> Neighbors(StreetNode n)
        {
            var parts = n.Key.Split(',');
            int i = int.Parse(parts[0]);
            int j = int.Parse(parts[1]);
            var output = new List<StreetNode>();
            if (VSegExists(i, j) && HExists(j + 1)) output.Add(Node(i, j + 1));
            if (VSegExists(i, j - 1) && HExists(j - 1)) output.Add(Node(i, j - 1));
            if (HSegExists(i, j) && VExists(i + 1)) output.Add(Node(i + 1, j));
            if (HSegExists(i - 1, j) && VExists(i - 1)) output.Add(Node(i - 1, j));
            return output;
        }
    }

    /// <summary>Concentric rings around the citadel crossed by radial spokes.</summary>
    sealed class RadialPattern : ICityPattern
    {
        readonly EraLayout L;
        readonly double seed;
        readonly Site C;
        readonly double ringStep, sw, innerR;

        public RadialPattern(Era era, double seed)
        {
            L = era.Layout;
            this.seed = seed;
            C = Macro.SITES["citadel"];
            ringStep = L.BlockD;
            sw = L.StreetWidth;
            innerR = Macro.SITES["citadel"].Clear + 10;
        }

        static int SpokesAt(double r) => r < 220 ? 12 : r < 420 ? 24 : 48;
        double RingR(int k) => innerR + k * ringStep + (Hash.Noise2(k * 1.3, 0.5, seed) - 0.5) * 6;

        (double r, double a) Polar(double x, double z)
        {
            double dx = x - C.X;
            double dz = z - C.Z;
            return (M.Hypot(dx, dz), Math.Atan2(dz, dx));
        }

        public bool IsStreet(double x, double z)
        {
            var (r, a) = Polar(x, z);
            if (r < innerR - sw) return false;
            int k = (int)M.Round((r - innerR) / ringStep);
            if (k >= 0 && Math.Abs(r - RingR(k)) < sw / 2) return true;
            int n = SpokesAt(r);
            double step = (Math.PI * 2) / n;
            double s = M.Round(a / step);
            double da = Math.Abs(a - s * step);
            if (da * r < sw / 2 && Hash.Hash2(s, n, seed) > 0.15) return true;
            return false;
        }

        (double rMin, double rMax) RadiusRange(double x0, double z0, double x1, double z1)
        {
            double[] corners = { Polar(x0, z0).r, Polar(x1, z0).r, Polar(x0, z1).r, Polar(x1, z1).r };
            double rMin = Math.Min(Math.Min(corners[0], corners[1]), Math.Min(corners[2], corners[3]));
            double rMax = Math.Max(Math.Max(corners[0], corners[1]), Math.Max(corners[2], corners[3]));
            if (x0 <= C.X && x1 >= C.X && z0 <= C.Z && z1 >= C.Z) rMin = 0;
            return (rMin, rMax);
        }

        public List<Lot> LotsInRect(double x0, double z0, double x1, double z1)
        {
            var output = new List<Lot>();
            var (rMin, rMax) = RadiusRange(x0, z0, x1, z1);
            int k0 = Math.Max(0, (int)Math.Floor((rMin - innerR) / ringStep) - 1);
            int k1 = (int)Math.Floor((rMax - innerR) / ringStep) + 1;
            for (int k = k0; k <= k1; k++)
            {
                double rA = RingR(k) + sw / 2;
                double rB = RingR(k + 1) - sw / 2;
                if (rB - rA < 4) continue;
                double rMid = (rA + rB) / 2;
                int n = SpokesAt(rMid);
                double step = (Math.PI * 2) / n;
                // size lots by the inner arc so rings never overlap toward the centre
                int lotsPerSector = Math.Max(1, (int)Math.Floor((rA * step - sw) / L.LotSize));
                int depthLots = Math.Max(1, (int)Math.Floor((rB - rA) / L.LotSize));
                for (int s = 0; s < n; s++)
                {
                    for (int q = 0; q < lotsPerSector; q++)
                    {
                        for (int dq = 0; dq < depthLots; dq++)
                        {
                            bool onEdge = dq == 0 || dq == depthLots - 1 || q == 0 || q == lotsPerSector - 1;
                            if (!onEdge && Hash.Hash2(s * 31 + q, k * 17 + dq, seed + 3) < 0.7) continue;
                            double a = s * step + (sw / 2) / rMid + ((q + 0.5) * (rMid * step - sw)) / lotsPerSector / rMid;
                            double r = rA + (dq + 0.5) * ((rB - rA) / depthLots);
                            double x = C.X + Math.Cos(a) * r;
                            double z = C.Z + Math.Sin(a) * r;
                            if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
                            double w = Math.Min(L.LotSize, (rA * step - sw) / lotsPerSector);
                            double d = Math.Min(L.LotSize, (rB - rA) / depthLots);
                            bool facesIn = dq == 0;
                            output.Add(new Lot { X = x, Z = z, W = w, D = d, Rot = a + Math.PI / 2, Front = facesIn ? a + Math.PI : a, Seed = Hash.Hash2(s + k * 1000, q + dq * 100, seed) * 1e6, Weight = onEdge ? 1 : 0.6 });
                        }
                    }
                }
            }
            return output;
        }

        public List<Strip> StripsInRect(double x0, double z0, double x1, double z1)
        {
            var strips = new List<Strip>();
            var (rMin, rMax) = RadiusRange(x0, z0, x1, z1);
            const double pad = 20;
            bool InRect(double x, double z) => x >= x0 - pad && x < x1 + pad && z >= z0 - pad && z < z1 + pad;
            int k0 = Math.Max(0, (int)Math.Floor((rMin - innerR) / ringStep) - 1);
            int k1 = (int)Math.Floor((rMax - innerR) / ringStep) + 1;
            for (int k = k0; k <= k1; k++)
            {
                double r = RingR(k);
                int segs = Math.Max(24, (int)Math.Floor(r / 4));
                var cur = new List<P2>();
                for (int i = 0; i <= segs; i++)
                {
                    double a = ((double)i / segs) * Math.PI * 2;
                    double x = C.X + Math.Cos(a) * r;
                    double z = C.Z + Math.Sin(a) * r;
                    if (InRect(x, z)) cur.Add(new P2(x, z));
                    else if (cur.Count > 0)
                    {
                        if (cur.Count > 1) strips.Add(new Strip { Points = cur, Width = sw, Layer = 0 });
                        cur = new List<P2>();
                    }
                }
                if (cur.Count > 1) strips.Add(new Strip { Points = cur, Width = sw, Layer = 0 });
            }
            // spokes
            (double ra, double rb)[] spokeBands =
            {
                (innerR, 220),
                (220, 420),
                (420, 900),
            };
            foreach (var (ra, rb) in spokeBands)
            {
                if (rb < rMin || ra > rMax) continue;
                int n = SpokesAt((ra + rb) / 2);
                double step = (Math.PI * 2) / n;
                for (int s = 0; s < n; s++)
                {
                    if (Hash.Hash2(s, n, seed) <= 0.15) continue;
                    double a = s * step;
                    var pts = new List<P2>();
                    for (double r = ra; r <= rb; r += 10)
                    {
                        double x = C.X + Math.Cos(a) * r;
                        double z = C.Z + Math.Sin(a) * r;
                        if (InRect(x, z)) pts.Add(new P2(x, z));
                    }
                    if (pts.Count > 1) strips.Add(new Strip { Points = pts, Width = sw, Layer = 1 });
                }
            }
            return strips;
        }

        StreetNode Node(int k, int s, int n)
        {
            double r = RingR(k);
            double a = ((double)s / n) * Math.PI * 2;
            return new StreetNode { X = C.X + Math.Cos(a) * r, Z = C.Z + Math.Sin(a) * r, Key = $"{k},{s},{n}" };
        }

        public List<StreetNode> NodesInRect(double x0, double z0, double x1, double z1)
        {
            var output = new List<StreetNode>();
            for (int k = 0; k < 26; k++)
            {
                double r = RingR(k);
                int n = SpokesAt(r);
                for (int s = 0; s < n; s++)
                {
                    var nd = Node(k, s, n);
                    if (nd.X >= x0 && nd.X < x1 && nd.Z >= z0 && nd.Z < z1) output.Add(nd);
                }
            }
            return output;
        }

        public List<StreetNode> Neighbors(StreetNode nd)
        {
            var parts = nd.Key.Split(',');
            int k = int.Parse(parts[0]);
            int s = int.Parse(parts[1]);
            int n = int.Parse(parts[2]);
            var output = new List<StreetNode> { Node(k, (s + 1) % n, n), Node(k, (s + n - 1) % n, n) };
            if (k > 0)
            {
                int nIn = SpokesAt(RingR(k - 1));
                output.Add(Node(k - 1, (int)M.Round((double)(s * nIn) / n) % nIn, nIn));
            }
            int nOut = SpokesAt(RingR(k + 1));
            output.Add(Node(k + 1, (int)M.Round((double)(s * nOut) / n) % nOut, nOut));
            return output;
        }

        public List<Park> ParksInRect(double x0, double z0, double x1, double z1) => new();
        public bool IsPark(double x, double z) => false;
    }
}
