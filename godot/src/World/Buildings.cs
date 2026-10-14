using System;
using System.Collections.Generic;

namespace Chronopolis;

public sealed class BuiltBuilding : Collider
{
    public BuildingTemplate Template;
    public double DoorX, DoorZ;
    /// <summary>walkable floors, steps and column colliders around the body</summary>
    public List<Collider> Extra = new();
}

/// <summary>Port of buildings.ts: one building from an era template on a lot.</summary>
public static class Buildings
{
    const int DARK_WINDOW = 0x1e2228;
    const int IRON = 0x2a2a2e;

    static double TexRepeat(int tile)
    {
        switch (tile)
        {
            case Tile.BRICK: return 0.75;
            case Tile.STONE: return 0.32;
            case Tile.WOOD: return 0.5;
            case Tile.MUDBRICK: return 0.55;
            case Tile.TIMBERFRAME: return 0.25;
            case Tile.CONCRETE: return 0.35;
            case Tile.ROOFTILE: return 0.7;
            case Tile.THATCH: return 0.45;
            case Tile.SLATE: return 0.6;
            case Tile.GRASS: return 0.3;
            default: return 0.5;
        }
    }

    sealed class Face
    {
        /// <summary>face runs along local x (true) or local z (false)</summary>
        public bool AlongX;
        public double Sign;
        public double Len;
        /// <summary>distance of the face from the centre</summary>
        public double Off;

        public Face(bool alongX, double sign, double len, double off) { AlongX = alongX; Sign = sign; Len = len; Off = off; }
    }

    /// <summary>JS `Math.sign(v) || 1`.</summary>
    static double SignOr1(double v) => v > 0 ? 1 : v < 0 ? -1 : 1;

    static double Rot0(Lot lot) => lot.Rot;

    /// <summary>
    /// Builds one building from an era template on a lot. Returns its collider, or null if the
    /// lot was skipped. `detail` false skips the fine features (far chunks).
    /// </summary>
    public static BuiltBuilding BuildBuilding(MeshBuilder mb, Lot lot, Era era, double groundY, Rng rng, BuildingTemplate tmpl = null, bool detail = true, Func<double, double, double> groundAt = null)
    {
        groundAt ??= (_, _) => groundY;
        var t = tmpl ?? rng.Weighted(era.Buildings, b => b.Weight);
        bool Has(string f) => t.Has(f);
        double fp = rng.Range(t.Footprint[0], t.Footprint[1]);
        // How far this template's features stick out, so the footprint is shrunk to keep them inside the lot.
        double ov = t.Overhang ?? 0.35;
        double frontOut = 0.8;
        if (Has("porch") || t.Columns) frontOut = Math.Max(frontOut, 2.8);
        if (Has("arcade")) frontOut = Math.Max(frontOut, 2.6);
        if (Has("veranda")) frontOut = Math.Max(frontOut, 3.0);
        if (Has("awning")) frontOut = Math.Max(frontOut, 1.9);
        if (Has("bay")) frontOut = Math.Max(frontOut, 1.1);
        if (Has("balcony")) frontOut = Math.Max(frontOut, 1.0);
        if (Has("sign")) frontOut = Math.Max(frontOut, 0.9);
        if (t.Stilts) frontOut = Math.Max(frontOut, 1.6);
        double sideOut = Math.Max(0.35, ov + 0.15);
        if (Has("fireEscape")) sideOut = Math.Max(sideOut, 1.3);
        if (Has("buttress")) sideOut = Math.Max(sideOut, 1.3);
        if (Has("eaves")) sideOut = Math.Max(sideOut, ov + 0.35);
        if (Has("plinth") || Has("cornice")) sideOut = Math.Max(sideOut, 0.45);
        double fa0 = lot.Front - Rot0(lot);
        bool frontAlongZ0 = Math.Abs(Math.Sin(fa0)) >= Math.Abs(Math.Cos(fa0));
        // usable extents inside the lot after setbacks (front/back along the front axis, sides across it)
        double lotAlong = frontAlongZ0 ? lot.D : lot.W;
        double lotAcross = frontAlongZ0 ? lot.W : lot.D;
        double usableAlong = Math.Max(3.2, lotAlong - frontOut - sideOut);
        double usableAcross = Math.Max(3.2, lotAcross - 2 * sideOut);
        double along = Math.Max(3.2, usableAlong * fp);
        double across = Math.Max(3.2, usableAcross * fp);
        if (t.Round)
        {
            double r = Math.Min(along, across);
            along = r;
            across = r;
        }
        double w = frontAlongZ0 ? across : along;
        double d = frontAlongZ0 ? along : across;
        // shift the body back so the front features land inside the lot
        double backShift = (frontOut - sideOut) / 2;
        int floors = rng.Int(t.Floors[0], t.Floors[1]);
        double fh = t.FloorHeight;
        double h = floors * fh;
        int wall = M.Shade(rng.Pick(t.WallColors), rng.Range(0.88, 1.08));
        int roofColor = M.Shade(rng.Pick(t.RoofColors), rng.Range(0.9, 1.05));
        int accent = t.Accent ?? t.Trim ?? M.Shade(wall, 0.6);
        int wallTex = t.Tex ?? Tile.PLASTER;
        double wallRep = t.TexRepeat ?? TexRepeat(wallTex);
        int roofTex = t.RoofTex ?? (t.Roof == "thatch" ? Tile.THATCH : t.Roof == "flat" ? Tile.CONCRETE : Tile.ROOFTILE);
        bool hasTrim = t.Trim.HasValue && t.Trim.Value != 0; // JS truthiness of t.trim
        double rot = lot.Rot;
        double cs = Math.Cos(rot);
        double sn = Math.Sin(rot);
        double frontSign0 = frontAlongZ0 ? SignOr1(Math.Sin(fa0)) : SignOr1(Math.Cos(fa0));
        double shiftLx = frontAlongZ0 ? 0 : -frontSign0 * backShift;
        double shiftLz = frontAlongZ0 ? -frontSign0 * backShift : 0;
        double x = lot.X + shiftLx * cs - shiftLz * sn;
        double z = lot.Z + shiftLx * sn + shiftLz * cs;
        // the building stands on the highest corner of its footprint; a foundation fills down to the lowest
        var corners = new (double, double)[]
        {
            (x + (w / 2) * cs - (d / 2) * sn, z + (w / 2) * sn + (d / 2) * cs),
            (x - (w / 2) * cs - (d / 2) * sn, z - (w / 2) * sn + (d / 2) * cs),
            (x + (w / 2) * cs + (d / 2) * sn, z + (w / 2) * sn - (d / 2) * cs),
            (x - (w / 2) * cs + (d / 2) * sn, z - (w / 2) * sn - (d / 2) * cs),
        };
        double minY = groundY;
        double maxY = groundY;
        foreach (var (cx2, cz2) in corners)
        {
            double gy = groundAt(cx2, cz2);
            if (gy < minY) minY = gy;
            if (gy > maxY) maxY = gy;
        }
        double baseY = maxY + 0.05;
        double foundationDepth = baseY - minY + 0.6;
        (double, double) W(double lx, double lz) => (x + lx * cs - lz * sn, z + lx * sn + lz * cs);
        // world-space outward normal of a face
        (double, double) N(Face f) => f.AlongX ? (-f.Sign * sn, f.Sign * cs) : (f.Sign * cs, f.Sign * sn);
        // world point on a face at local coordinate u, `out` metres outside the wall
        (double, double) P(Face f, double u, double outD) => f.AlongX ? W(u, f.Sign * (f.Off + outD)) : W(f.Sign * (f.Off + outD), u);
        double G((double, double) p) => groundAt(p.Item1, p.Item2);

        double fa = lot.Front - rot;
        double fxv = Math.Cos(fa);
        double fzv = Math.Sin(fa);
        bool frontIsZ = Math.Abs(fzv) >= Math.Abs(fxv);
        double frontSign = frontIsZ ? SignOr1(fzv) : SignOr1(fxv);
        var faces = new Face[]
        {
            new(true, 1, w, d / 2),
            new(true, -1, w, d / 2),
            new(false, 1, d, w / 2),
            new(false, -1, d, w / 2),
        };
        bool IsFront(Face f) => f.AlongX == frontIsZ && f.Sign == frontSign;
        Face front = Array.Find(faces, IsFront);
        double frontRot = frontIsZ ? rot : rot + Math.PI / 2;
        Func<double, double> insetAt = Has("battered")
            ? (yy) => (0.1 * Math.Min(w, d) * 0.5 * (yy - baseY)) / h
            : (_) => 0;
        void WallMat() => mb.Material(wallTex, wallRep);
        void StoneMat() => mb.Material(Tile.STONE, 0.35);
        var extra = new List<Collider>();
        // a walkable floor in front of the building, `out0..out1` metres from the front wall
        void FrontFloor(double out0, double out1, double span, double top)
        {
            var (cx, cz) = P(front, 0, (out0 + out1) / 2);
            double dd = (out1 - out0) / 2;
            extra.Add(new Collider { X = cx, Z = cz, Hw = frontIsZ ? span / 2 : dd, Hd = frontIsZ ? dd : span / 2, Rot = rot, H = 0, Top = top, Tag = "floor" });
        }
        // a column or post that blocks
        void Post(double px, double pz, double r, double ph)
        {
            extra.Add(new Collider { X = px, Z = pz, Hw = r, Hd = r, Rot = rot, H = ph, Tag = "post" });
        }
        // steps from the ground up to `top`, leaving the front at `edgeOut`, with a ramp collider
        void FrontSteps(double edgeOut, double top, double width, int color, double u = 0)
        {
            var (gx, gz) = P(front, u, edgeOut + 0.8);
            double gy = groundAt(gx, gz);
            double rise = top - gy;
            if (rise <= 0.12) return;
            double n = Math.Min(6, Math.Max(1, Math.Ceiling(rise / 0.25)));
            double run = 0.32;
            for (int i = 0; i < n; i++)
            {
                var (px, pz) = P(front, u, edgeOut + (i + 0.5) * run);
                double sh = top - (i * rise) / n;
                double sy = Math.Min(gy, groundAt(px, pz)) - 0.2;
                if (frontIsZ) mb.Box(px, sy, pz, width, sh - sy, run + 0.02, color, rot);
                else mb.Box(px, sy, pz, run + 0.02, sh - sy, width, color, rot);
            }
            var (fx0, fz0) = P(front, u, edgeOut + n * run);
            var (tx0, tz0) = P(front, u, edgeOut);
            extra.Add(Collision.Ramp(fx0, fz0, gy, tx0, tz0, top, width, "steps"));
        }
        // the middle of the central opening in a row of n evenly spaced supports spanning `width`
        double OpenBay(double n, double width) => n % 2 == 0 ? 0 : width / (n - 1) / 2;
        bool hasFrontDeck = !t.Stilts && !t.Round && (Has("porch") || t.Columns || Has("arcade") || Has("veranda"));

        if (t.Stilts)
        {
            double lift = 2.2;
            mb.Material(Tile.WOOD, 0.6);
            int postColor = M.Shade(wall, 0.6);
            var stiltPts = new (double, double)[]
            {
                (-w / 2 + 0.4, -d / 2 + 0.4),
                (w / 2 - 0.4, -d / 2 + 0.4),
                (w / 2 - 0.4, d / 2 - 0.4),
                (-w / 2 + 0.4, d / 2 - 0.4),
                (0, -d / 2 + 0.4),
                (0, d / 2 - 0.4),
            };
            foreach (var (px, pz) in stiltPts)
            {
                var (wx, wz) = W(px, pz);
                double gy = groundAt(wx, wz);
                mb.Box(wx, gy - 0.5, wz, 0.35, baseY + lift - gy + 0.5, 0.35, postColor, rot);
            }
            baseY = baseY + lift;
            var (sx, sz) = P(front, 0, 0.7);
            mb.Box(sx, groundAt(sx, sz) - 0.2, sz, 1.2, baseY - groundAt(sx, sz) + 0.2, 1.2, M.Shade(wall, 0.7), rot);
            // floor slab
            mb.Box(x, baseY - 0.25, z, w + 0.6, 0.25, d + 0.6, M.Shade(wall, 0.8), rot);
        }

        if (t.Tent)
        {
            mb.Material(Tile.THATCH, 0.4);
            mb.Cylinder(x, groundY - 0.2, z, Math.Min(w, d) / 2, 0, h, wall, 8, rot);
            return new BuiltBuilding { X = x, Z = z, Hw = w / 2 + 0.2, Hd = d / 2 + 0.2, Rot = rot, H = h, Tag = t.Tag, Template = t, DoorX = x, DoorZ = z, Extra = new List<Collider>() };
        }

        // ---------------- foundation ----------------
        // a stone podium from below the lowest corner up to the floor level, slightly wider than the body
        mb.Material(Tile.STONE, 0.4);
        double fw = Has("plinth") ? 0.3 : 0.24; // same width as the plinth so the two stack without a double edge
        if (t.Round) mb.Cylinder(x, minY - 0.6, z, w / 2 + fw / 2, w / 2 + fw / 2, foundationDepth, M.Shade(wall, 0.62), 12, rot);
        else mb.Box(x, minY - 0.6, z, w + fw, foundationDepth, d + fw, M.Shade(wall, 0.62), rot, 0.8);
        // steps up to the door when the ground in front is lower than the floor
        if (!t.Stilts && !hasFrontDeck)
        {
            // a small landing at floor level in front of the door, then the flight down to the street
            var (lx, lz) = P(front, 0, 0.35);
            var (gx, gz) = P(front, 0, 1.2);
            if (baseY - groundAt(gx, gz) > 0.12)
            {
                double ly = Math.Min(groundAt(lx, lz), groundAt(gx, gz)) - 0.2;
                if (frontIsZ) mb.Box(lx, ly, lz, 2.6, baseY - ly, 0.72, M.Shade(wall, 0.66), rot);
                else mb.Box(lx, ly, lz, 0.72, baseY - ly, 2.6, M.Shade(wall, 0.66), rot);
                FrontFloor(0, 0.7, 2.6, baseY);
            }
            FrontSteps(0.7, baseY, 2.4, M.Shade(wall, 0.7));
        }

        // ---------------- body ----------------
        WallMat();
        if (t.Round)
        {
            double r = w / 2;
            mb.Cylinder(x, baseY - 0.1, z, r, r, h + 0.1, wall, 12, rot);
            if (Has("bands"))
            {
                mb.Cylinder(x, baseY + 0.15, z, r + 0.06, r + 0.06, 0.35, accent, 12, rot);
                mb.Cylinder(x, baseY + h - 0.5, z, r + 0.06, r + 0.06, 0.3, accent, 12, rot);
            }
            if (hasTrim) mb.Cylinder(x, baseY + h * 0.35, z, r + 0.08, r + 0.08, 0.5, t.Trim.Value, 12, rot);
            // door
            mb.Material(Tile.WOOD, 0.6);
            var (nx, nz) = N(front);
            mb.WallQuad(x + nx * (r + 0.04), baseY, z + nz * (r + 0.04), 1.1, Math.Min(2.0, h * 0.8), nx, nz, t.Tag == "ger" || t.Tag == "great_ger" ? accent : 0x3a2a1a);
            mb.Material(roofTex, TexRepeat(roofTex));
            if (t.Roof == "dome") mb.Dome(x, baseY + h, z, r + 0.15, roofColor, 12, 4);
            else mb.Cylinder(x, baseY + h, z, r + 0.5, 0, Math.Max(1.5, r * 0.9), roofColor, 12, rot);
        }
        else if (t.Courtyard && w > 7 && d > 7)
        {
            double wing = Math.Min(w, d) * 0.3;
            var wings = new (double, double, double, double)[]
            {
                (0, -d / 2 + wing / 2, w, wing),
                (0, d / 2 - wing / 2, w, wing),
                (-w / 2 + wing / 2, 0, wing, d - wing * 2),
                (w / 2 - wing / 2, 0, wing, d - wing * 2),
            };
            foreach (var (lx, lz, ww, dd) in wings)
            {
                var (wx, wz) = W(lx, lz);
                WallMat();
                mb.Box(wx, baseY - 0.1, wz, ww, h + 0.1, dd, wall, rot, 0.78);
                AddRoof(mb, t, wx, baseY + h, wz, ww, dd, rot, roofColor, wall, 0, true, roofTex);
            }
            if (t.Parapet)
            {
                WallMat();
                mb.Box(x, baseY + h - 0.1, z, w + 0.3, 0.5, d + 0.3, M.Shade(wall, 0.85), rot);
            }
            // courtyard floor and a tree or fountain
            mb.Material(Tile.SAND, 0.4);
            mb.Box(x, baseY - 0.5, z, w - wing * 2, 0.55, d - wing * 2, M.Shade(wall, 0.75), rot);
        }
        else if (t.Setback && floors >= 6)
        {
            double h1 = h * 0.45;
            double h2 = h * 0.3;
            double h3 = h * 0.25;
            mb.Box(x, baseY - 0.1, z, w, h1 + 0.1, d, wall, rot, 0.78);
            mb.Box(x, baseY + h1, z, w * 0.78, h2, d * 0.78, wall, rot);
            mb.Box(x, baseY + h1 + h2, z, w * 0.55, h3, d * 0.55, wall, rot);
            if (detail)
            {
                Windows(mb, faces, N, P, baseY, (int)Math.Floor(floors * 0.45), fh, t, accent, wall, _ => 0, IsFront, 0);
                var f2 = Array.ConvertAll(faces, f => new Face(f.AlongX, f.Sign, f.Len * 0.78, f.Off * 0.78));
                var f3 = Array.ConvertAll(faces, f => new Face(f.AlongX, f.Sign, f.Len * 0.55, f.Off * 0.55));
                Windows(mb, f2, N, P, baseY + h1, (int)Math.Floor(floors * 0.3), fh, t, accent, wall, _ => 0, _ => false, 1);
                Windows(mb, f3, N, P, baseY + h1 + h2, (int)Math.Floor(floors * 0.25), fh, t, accent, wall, _ => 0, _ => false, 1);
                if (Has("ledges"))
                {
                    WallMat();
                    mb.Box(x, baseY + h1 - 0.2, z, w + 0.3, 0.4, d + 0.3, M.Shade(wall, 0.85), rot);
                    mb.Box(x, baseY + h1 + h2 - 0.2, z, w * 0.78 + 0.3, 0.4, d * 0.78 + 0.3, M.Shade(wall, 0.85), rot);
                }
            }
            WallMat();
            mb.Box(x, baseY + h, z, w * 0.2, 2, d * 0.2, M.Shade(wall, 0.9), rot);
            mb.Material(Tile.CONCRETE, 0.5);
            mb.Cylinder(x, baseY + h + 2, z, 0.3, 0.05, 6, 0x9a9aa0, 6);
        }
        else if (Has("battered"))
        {
            mb.Hip(x, baseY - 0.1, z, w, h + 0.1, d, w * 0.9, d * 0.9, wall, rot);
            if (detail) Windows(mb, faces, N, P, baseY, floors, fh, t, accent, wall, insetAt, IsFront, 0);
            if (t.Parapet) mb.Box(x, baseY + h - 0.1, z, w * 0.9 + 0.3, 0.5, d * 0.9 + 0.3, M.Shade(wall, 0.85), rot);
        }
        else
        {
            mb.Box(x, baseY - 0.1, z, w, h + 0.1, d, wall, rot, 0.78);
            if (detail) Windows(mb, faces, N, P, baseY, floors, fh, t, accent, wall, insetAt, IsFront, 0);
            if (hasTrim && !Has("bands"))
            {
                WallMat();
                mb.Box(x, baseY, z, w + 0.2, 0.7, d + 0.2, t.Trim.Value, rot);
            }
            AddRoof(mb, t, x, baseY + h, z, w, d, rot, roofColor, wall, floors, false, roofTex);
        }

        // ---------------- silhouette features (all detail levels) ----------------
        if (Has("plinth"))
        {
            StoneMat();
            double ins = insetAt(baseY);
            mb.Box(x, baseY, z, w - ins * 2 + 0.3, 0.7, d - ins * 2 + 0.3, M.Shade(wall, 0.72), rot);
        }
        if (Has("cornice") && !t.Round)
        {
            WallMat();
            double ins = insetAt(baseY + h);
            mb.Box(x, baseY + h - 0.35, z, w - ins * 2 + 0.5, 0.35, d - ins * 2 + 0.5, M.Shade(wall, 0.9), rot);
            mb.Box(x, baseY + h - 0.65, z, w - ins * 2 + 0.25, 0.3, d - ins * 2 + 0.25, M.Shade(wall, 0.95), rot);
        }
        if (Has("falsefront"))
        {
            WallMat();
            double rise = Math.Min(w, d) * 0.38;
            var (cx, cz) = P(front, 0, -0.2);
            double ffh = rise + 1.4;
            if (frontIsZ) mb.Box(cx, baseY + h - 0.1, cz, w + 0.3, ffh, 0.4, wall, rot);
            else mb.Box(cx, baseY + h - 0.1, cz, 0.4, ffh, d + 0.3, wall, rot);
            var (tx, tz) = P(front, 0, -0.2);
            if (frontIsZ) mb.Box(tx, baseY + h + ffh - 0.3, tz, w + 0.7, 0.4, 0.7, M.Shade(wall, 0.85), rot);
            else mb.Box(tx, baseY + h + ffh - 0.3, tz, 0.7, 0.4, d + 0.7, M.Shade(wall, 0.85), rot);
            if (Has("sign"))
            {
                mb.Material(Tile.WOOD, 0.5);
                var (sx, sz) = P(front, 0, 0.12);
                var (nx, nz) = N(front);
                mb.WallQuad(sx, baseY + h + 0.4, sz, front.Len * 0.6, 0.9, nx, nz, accent);
            }
        }
        if (Has("porch") || t.Columns)
        {
            double colH = Math.Min(h, fh * 1.6);
            int colColor = M.Shade(wall, 1.08);
            double span = front.Len;
            double n = Math.Max(2, Math.Floor(span / 2.2));
            double depth = 2.0;
            // floor slab (stylobate) from the lowest ground under the porch up to floor level
            var (px, pz) = P(front, 0, depth / 2);
            double gLow = Math.Min(Math.Min(G(P(front, -span / 2, depth)), G(P(front, span / 2, depth))), groundAt(px, pz));
            StoneMat();
            if (frontIsZ) mb.Box(px, gLow - 0.3, pz, span + 0.6, baseY - gLow + 0.3, depth + 0.3, M.Shade(wall, 0.8), rot, 0.8);
            else mb.Box(px, gLow - 0.3, pz, depth + 0.3, baseY - gLow + 0.3, span + 0.6, M.Shade(wall, 0.8), rot, 0.8);
            for (int i = 0; i < n; i++)
            {
                double u = -span / 2 + 0.6 + (i / (n - 1)) * (span - 1.2);
                var (cx, cz) = P(front, u, depth - 0.45);
                mb.Cylinder(cx, baseY, cz, 0.32, 0.28, colH, colColor, 8);
                mb.Box(cx, baseY + colH - 0.05, cz, 0.8, 0.3, 0.8, colColor, rot);
                // the middle bay stays open for the steps
                Post(cx, cz, 0.34, colH);
            }
            FrontFloor(0, depth + 0.15, span + 0.6, baseY);
            StoneMat();
            double bay = (span - 1.2) / (n - 1);
            FrontSteps(depth + 0.15, baseY, Math.Min(3.2, bay - 0.8), M.Shade(wall, 0.75), OpenBay(n, span - 1.2));
            WallMat();
            if (frontIsZ) mb.Box(px, baseY + colH + 0.2, pz, w + 0.4, 0.5, depth + 0.4, M.Shade(wall, 0.95), rot);
            else mb.Box(px, baseY + colH + 0.2, pz, depth + 0.4, 0.5, d + 0.4, M.Shade(wall, 0.95), rot);
        }
        if (Has("arcade") && !t.Round)
        {
            // ground-floor arcade along the front: pillars, lintel, arched openings
            double span = front.Len;
            double n = Math.Max(2, M.Round(span / 2.8));
            double step = span / n;
            double ah = fh - 0.3;
            StoneMat();
            for (int i = 0; i <= n; i++)
            {
                double u = -span / 2 + i * step;
                var (cx, cz) = P(front, Math.Max(-span / 2 + 0.35, Math.Min(span / 2 - 0.35, u)), 1.3);
                mb.Box(cx, baseY - 0.05, cz, 0.7, ah, 0.7, M.Shade(wall, 1.05), rot);
            }
            var (lx, lz) = P(front, 0, 0.75);
            if (frontIsZ) mb.Box(lx, baseY + ah - 0.35, lz, span + 0.5, 0.55, 1.9, M.Shade(wall, 0.95), rot);
            else mb.Box(lx, baseY + ah - 0.35, lz, 1.9, 0.55, span + 0.5, M.Shade(wall, 0.95), rot);
            var (fx2, fz2) = P(front, 0, 0.85);
            double gLow = Math.Min(Math.Min(G(P(front, -span / 2, 1.8)), G(P(front, span / 2, 1.8))), groundAt(fx2, fz2));
            mb.Material(Tile.SLAB, 0.4);
            if (frontIsZ) mb.Box(fx2, gLow - 0.3, fz2, span + 0.4, baseY - gLow + 0.36, 1.9, M.Shade(wall, 0.8), rot, 0.8);
            else mb.Box(fx2, gLow - 0.3, fz2, 1.9, baseY - gLow + 0.36, span + 0.4, M.Shade(wall, 0.8), rot, 0.8);
            FrontFloor(-0.1, 1.8, span + 0.4, baseY + 0.06);
            for (int i = 0; i <= n; i++)
            {
                double u = -span / 2 + i * step;
                var (cx, cz) = P(front, Math.Max(-span / 2 + 0.35, Math.Min(span / 2 - 0.35, u)), 1.3);
                Post(cx, cz, 0.36, ah);
            }
            StoneMat();
            FrontSteps(1.8, baseY + 0.06, Math.Min(2.6, step - 0.8), M.Shade(wall, 0.78), OpenBay(n + 1, span));
            if (detail)
            {
                mb.Material(Tile.CONCRETE, 0.3);
                var (nx, nz) = N(front);
                for (int i = 0; i < n; i++)
                {
                    double u = -span / 2 + (i + 0.5) * step;
                    var (ox, oz) = P(front, u, 0.05);
                    mb.ArchQuad(ox, baseY + 0.05, oz, Math.Min(1.8, step - 0.9), ah - 0.6, nx, nz, DARK_WINDOW);
                }
            }
        }
        if (Has("bay") && floors >= 2 && !t.Round)
        {
            int nb = front.Len > 11 ? 2 : 1;
            double bh = Math.Min(2, floors) * fh - 0.35;
            for (int i = 0; i < nb; i++)
            {
                double u = nb == 1 ? -front.Len * 0.22 : (i == 0 ? -1 : 1) * front.Len * 0.28;
                var (bx, bz) = P(front, u, 0.45);
                WallMat();
                if (frontIsZ) mb.Box(bx, baseY, bz, 2.6, bh, 0.9, wall, rot, 0.78);
                else mb.Box(bx, baseY, bz, 0.9, bh, 2.6, wall, rot, 0.78);
                mb.Material(roofTex, TexRepeat(roofTex));
                mb.Hip(bx, baseY + bh, bz, frontIsZ ? 3.0 : 1.3, 0.5, frontIsZ ? 1.3 : 3.0, 0, 0, roofColor, rot);
                if (detail)
                {
                    mb.Material(Tile.CONCRETE, 0.3);
                    var (nx, nz) = N(front);
                    int winColor = t.WindowColor ?? DARK_WINDOW;
                    for (int f = 0; f < Math.Min(2, floors); f++)
                    {
                        double wy = baseY + f * fh + fh * 0.3;
                        var (wx, wz) = P(front, u, 0.94);
                        mb.WallQuad(wx, wy, wz, 1.4, Math.Min(1.6, fh * 0.5), nx, nz, winColor);
                        // side panes
                        var (tx, tz) = frontIsZ ? (cs, sn) : (-sn, cs);
                        mb.WallQuad(wx + tx * 1.34, wy, wz + tz * 1.34, 0.7, Math.Min(1.6, fh * 0.5), tx, tz, winColor);
                        mb.WallQuad(wx - tx * 1.34, wy, wz - tz * 1.34, 0.7, Math.Min(1.6, fh * 0.5), -tx, -tz, winColor);
                    }
                }
            }
        }
        if (Has("turret") || t.Tower)
        {
            double tw = Math.Min(w, d) * 0.4;
            var (cx, cz) = W(-w / 2 + tw / 2, -d / 2 + tw / 2);
            double th = h * 1.6 + 2;
            WallMat();
            mb.Box(cx, baseY, cz, tw, th, tw, M.Shade(wall, 0.96), rot, 0.8);
            mb.Material(roofTex, TexRepeat(roofTex));
            mb.Hip(cx, baseY + th, cz, tw + 0.4, tw * 0.9, tw + 0.4, 0, 0, roofColor, rot);
        }
        if (t.Chimney || Has("chimneypots"))
        {
            var (cx, cz) = W(w / 2 - 0.9, -d / 2 + 0.9);
            mb.Material(Tile.BRICK, 0.8);
            double ch = h * 0.45 + 1.8;
            mb.Box(cx, baseY + h * 0.6, cz, 0.8, ch, 0.8, M.Shade(wall, 0.6), rot);
            if (Has("chimneypots"))
            {
                mb.Material(Tile.CONCRETE, 0.5);
                mb.Cylinder(cx - 0.2 * cs, baseY + h * 0.6 + ch, cz - 0.2 * sn, 0.14, 0.12, 0.6, 0x8a4a3a, 6);
                mb.Cylinder(cx + 0.2 * cs, baseY + h * 0.6 + ch, cz + 0.2 * sn, 0.14, 0.12, 0.6, 0x8a4a3a, 6);
            }
        }
        if (t.Smokestack)
        {
            var (cx, cz) = W(w / 2 - 1.5, d / 2 - 1.5);
            mb.Material(Tile.BRICK, 0.8);
            mb.Cylinder(cx, baseY, cz, 1.1, 0.8, h + 9 + rng.Range(0, 6), 0x3a3230, 8);
        }
        if (Has("crenellation") && !t.Round)
        {
            WallMat();
            double ins = insetAt(baseY + h);
            foreach (var f in faces)
            {
                double n = Math.Max(2, Math.Floor((f.Len - 1) / 1.8));
                for (int i = 0; i < n; i++)
                {
                    double u = -f.Len / 2 + 0.6 + (i / (n - 1)) * (f.Len - 1.2);
                    var (mx, mz) = P(f, u, -ins - 0.3);
                    mb.Box(mx, baseY + h + 0.2, mz, f.AlongX ? 1.0 : 0.6, 0.8, f.AlongX ? 0.6 : 1.0, M.Shade(wall, 0.92), rot);
                }
            }
        }

        // ---------------- fine features (near chunks only) ----------------
        if (detail)
        {
            if (Has("ledges") && floors >= 2 && !t.Round && !t.Setback)
            {
                WallMat();
                for (int f = 1; f < floors; f++)
                {
                    double ins = insetAt(baseY + f * fh);
                    mb.Box(x, baseY + f * fh - 0.08, z, w - ins * 2 + 0.16, 0.16, d - ins * 2 + 0.16, M.Shade(wall, 0.85), rot);
                }
            }
            if (Has("bands") && !t.Round)
            {
                WallMat();
                foreach (double yy in new[] { baseY + 0.3, baseY + h - 0.7 })
                {
                    double ins = insetAt(yy);
                    mb.Box(x, yy, z, w - ins * 2 + 0.06, 0.35, d - ins * 2 + 0.06, accent, rot);
                }
            }
            if (Has("corners") && !t.Round)
            {
                StoneMat();
                var cornerPts = new (double, double)[] { (-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2) };
                foreach (var (lx, lz) in cornerPts)
                {
                    var (cx, cz) = W(lx, lz);
                    mb.Box(cx, baseY, cz, 0.45, h, 0.45, M.Shade(wall, 1.1), rot);
                }
            }
            if (Has("pilasters") && !t.Round)
            {
                WallMat();
                foreach (var f in faces)
                {
                    double n = Math.Max(1, M.Round(f.Len / 3.2));
                    for (int i = 0; i <= n; i++)
                    {
                        double u = -f.Len / 2 + (i * f.Len) / n;
                        var (px, pz) = P(f, Math.Max(-f.Len / 2 + 0.3, Math.Min(f.Len / 2 - 0.3, u)), 0.12);
                        mb.Box(px, baseY - 0.3, pz, f.AlongX ? 0.5 : 0.3, h + 0.3, f.AlongX ? 0.3 : 0.5, M.Shade(wall, 1.06), rot);
                    }
                }
            }
            if (Has("buttress") && !t.Round)
            {
                WallMat();
                foreach (var f in faces)
                {
                    if (IsFront(f)) continue;
                    double n = Math.Max(1, Math.Floor(f.Len / 4));
                    for (int i = 0; i <= n; i++)
                    {
                        double u = -f.Len / 2 + (i * f.Len) / n;
                        var (px, pz) = P(f, Math.Max(-f.Len / 2 + 0.5, Math.Min(f.Len / 2 - 0.5, u)), 0.5);
                        mb.Box(px, baseY - 0.3, pz, f.AlongX ? 0.8 : 1.0, h * 0.6, f.AlongX ? 1.0 : 0.8, M.Shade(wall, 0.95), rot);
                    }
                }
            }
            if (Has("eaves") && t.Roof != "flat" && !t.Round)
            {
                mb.Material(Tile.WOOD, 0.6);
                double eov = t.Overhang ?? 0.35;
                foreach (var f in faces)
                {
                    if (f.AlongX != front.AlongX) continue; // brackets under the two eave-side faces only
                    double n = Math.Max(2, Math.Floor(f.Len / 2.2));
                    for (int i = 0; i < n; i++)
                    {
                        double u = -f.Len / 2 + 0.5 + (i / (n - 1)) * (f.Len - 1);
                        var (px, pz) = P(f, u, eov / 2 + 0.1);
                        mb.Box(px, baseY + h - 0.6, pz, f.AlongX ? 0.25 : eov + 0.3, 0.5, f.AlongX ? eov + 0.3 : 0.25, M.Shade(roofColor, 0.75), rot);
                    }
                }
            }
            if (Has("ridge") && (t.Roof == "gable" || t.Roof == "thatch") && !t.Round)
            {
                mb.Material(Tile.WOOD, 0.6);
                bool alongX = w >= d;
                double rh = (t.Roof == "thatch" ? 0.5 : 0.38) * Math.Min(w, d);
                double len = (alongX ? w : d) + (t.Overhang ?? 0.35) * 2;
                double rr = alongX ? rot : rot + Math.PI / 2;
                mb.Box(x, baseY + h + rh - 0.1, z, len + 0.3, 0.28, 0.4, M.Shade(roofColor, 0.65), rr);
                var (e1x, e1z) = alongX ? W(-len / 2, 0) : W(0, -len / 2);
                var (e2x, e2z) = alongX ? W(len / 2, 0) : W(0, len / 2);
                mb.Box(e1x, baseY + h + rh - 0.3, e1z, 0.3, 1.1, 0.3, M.Shade(roofColor, 0.55), rr);
                mb.Box(e2x, baseY + h + rh - 0.3, e2z, 0.3, 1.1, 0.3, M.Shade(roofColor, 0.55), rr);
            }
            if (Has("horns"))
            {
                StoneMat();
                foreach (double u in new[] { -front.Len * 0.3, front.Len * 0.3 })
                {
                    var (hx, hz) = P(front, u, -0.6);
                    mb.Box(hx, baseY + h, hz, 1.6, 0.4, 0.5, 0xf4ecd8, frontRot);
                    mb.Hip(hx - 0.55 * Math.Cos(frontRot), baseY + h + 0.4, hz - 0.55 * Math.Sin(frontRot), 0.4, 0.8, 0.4, 0.1, 0.1, 0xf4ecd8, frontRot);
                    mb.Hip(hx + 0.55 * Math.Cos(frontRot), baseY + h + 0.4, hz + 0.55 * Math.Sin(frontRot), 0.4, 0.8, 0.4, 0.1, 0.1, 0xf4ecd8, frontRot);
                }
            }
            if (Has("rooftank") && t.Roof == "flat" && !t.Setback)
            {
                mb.Material(Tile.WOOD, 0.6);
                double rtx = rng.Range(-w / 2 + 2, w / 2 - 2);
                double rtz = rng.Range(-d / 2 + 2, d / 2 - 2);
                var (tx, tz) = W(rtx, rtz);
                double ty = baseY + h;
                var legs = new (double, double)[] { (-0.8, -0.8), (0.8, -0.8), (0.8, 0.8), (-0.8, 0.8) };
                foreach (var (ox, oz) in legs) mb.Box(tx + ox, ty, tz + oz, 0.18, 1.6, 0.18, IRON);
                mb.Cylinder(tx, ty + 1.6, tz, 1.2, 1.2, 2.2, 0x6a5a4a, 10);
                mb.Cylinder(tx, ty + 3.8, tz, 1.3, 0.1, 0.7, 0x4a3a2a, 10);
            }
            if (Has("fireEscape") && floors >= 2)
            {
                // on a side face (never the front)
                Face side = Array.Find(faces, f => f.AlongX != front.AlongX);
                mb.Material(Tile.CONCRETE, 0.5);
                var (nx, nz) = N(side);
                double u = -side.Len * 0.2;
                for (int f = 1; f < floors; f++)
                {
                    double py = baseY + f * fh + 0.1;
                    var (px, pz) = P(side, u, 0.55);
                    double srot = side.AlongX ? rot : rot + Math.PI / 2;
                    mb.Box(px, py, pz, 3.0, 0.1, 1.1, IRON, srot);
                    var (rx, rz) = P(side, u, 1.08);
                    mb.Box(rx, py, rz, 3.0, 0.95, 0.06, IRON, srot);
                    // stair panel to the floor below
                    var (ax, az) = P(side, u + 1.2, 1.0);
                    var (bx, bz) = P(side, u - 1.2, 1.0);
                    if (f > 1) mb.Panel(ax, py - fh, az, ax + nx * 0.02, py - fh, az + nz * 0.02, bx + nx * 0.02, py, bz + nz * 0.02, bx, py, bz, M.Shade(IRON, 1.4));
                }
                var (lx, lz) = P(side, u - 1.2, 1.0);
                mb.Box(lx, baseY + fh - 1.4, lz, 0.15, 1.5, 0.15, IRON, rot);
            }
            if (Has("balcony") && floors >= 2)
            {
                mb.Material(Tile.WOOD, 0.6);
                double n = Math.Max(1, Math.Floor((front.Len - 0.8) / 2.3));
                double step = front.Len / n;
                for (int f = 1; f < floors; f++)
                {
                    for (int i = 0; i < n; i++)
                    {
                        if (rng.Chance(0.55)) continue;
                        double u = -front.Len / 2 + (i + 0.5) * step;
                        var (px, pz) = P(front, u, 0.45);
                        mb.Box(px, baseY + f * fh - 0.05, pz, frontIsZ ? 1.8 : 0.85, 0.15, frontIsZ ? 0.85 : 1.8, M.Shade(wall, 0.7), rot);
                        var (rx, rz) = P(front, u, 0.85);
                        mb.Box(rx, baseY + f * fh + 0.1, rz, frontIsZ ? 1.8 : 0.06, 0.9, frontIsZ ? 0.06 : 1.8, accent, rot);
                    }
                }
            }
            if (Has("veranda"))
            {
                mb.Material(Tile.WOOD, 0.6);
                double span = front.Len;
                double n = Math.Max(2, Math.Floor(span / 2.4));
                double vh = fh - 0.2;
                for (int i = 0; i < n; i++)
                {
                    double u = -span / 2 + 0.4 + (i / (n - 1)) * (span - 0.8);
                    var (cx, cz) = P(front, u, 1.9);
                    mb.Box(cx, baseY, cz, 0.18, vh, 0.18, M.Shade(wall, 0.6), rot);
                    Post(cx, cz, 0.12, vh);
                }
                var (px, pz) = P(front, 0, 1.0);
                double gLow = Math.Min(Math.Min(G(P(front, -span / 2, 2.1)), G(P(front, span / 2, 2.1))), groundAt(px, pz));
                if (frontIsZ)
                {
                    mb.Box(px, gLow - 0.3, pz, span + 0.2, baseY + 0.14 - gLow + 0.3, 2.1, M.Shade(wall, 0.8), rot, 0.8);
                    mb.Box(px, baseY + vh - 0.1, pz, span + 0.5, 0.2, 2.4, M.Shade(roofColor, 1.0), rot);
                }
                else
                {
                    mb.Box(px, gLow - 0.3, pz, 2.1, baseY + 0.14 - gLow + 0.3, span + 0.2, M.Shade(wall, 0.8), rot, 0.8);
                    mb.Box(px, baseY + vh - 0.1, pz, 2.4, 0.2, span + 0.5, M.Shade(roofColor, 1.0), rot);
                }
                // railing in two runs, open at the steps (which sit between two posts)
                double gc = OpenBay(n, span - 0.8);
                double gap = 1.1;
                var runs = new (double, double)[] { (-span / 2 + 0.3, gc - gap), (gc + gap, span / 2 - 0.3) };
                foreach (var (r0, r1) in runs)
                {
                    double len = r1 - r0;
                    if (len < 0.3) continue;
                    var (rx, rz) = P(front, (r0 + r1) / 2, 1.95);
                    if (frontIsZ) mb.Box(rx, baseY + 0.9, rz, len, 0.08, 0.08, M.Shade(wall, 0.6), rot);
                    else mb.Box(rx, baseY + 0.9, rz, 0.08, 0.08, len, M.Shade(wall, 0.6), rot);
                    extra.Add(new Collider { X = rx, Z = rz, Hw = frontIsZ ? len / 2 : 0.1, Hd = frontIsZ ? 0.1 : len / 2, Rot = rot, H = 1, Tag = "rail" });
                }
                FrontFloor(-0.05, 2.05, span + 0.2, baseY + 0.14);
                FrontSteps(2.05, baseY + 0.14, 2.0, M.Shade(wall, 0.7), gc);
            }
            if (Has("lattice"))
            {
                mb.Material(Tile.WOOD, 0.8);
                var (nx, nz) = N(front);
                double span = front.Len * 0.7;
                double n = Math.Floor(span / 0.32);
                for (int i = 0; i < n; i++)
                {
                    double u = -span / 2 + (i + 0.5) * (span / n);
                    if (Math.Abs(u) < 0.9) continue; // door
                    var (px, pz) = P(front, u, 0.1);
                    mb.WallQuad(px, baseY + 0.5, pz, 0.08, Math.Min(2.0, fh * 0.7), nx, nz, accent);
                }
                var (rx, rz) = P(front, 0, 0.12);
                mb.Box(rx, baseY + 0.5 + Math.Min(2.0, fh * 0.7), rz, frontIsZ ? span : 0.1, 0.1, frontIsZ ? 0.1 : span, accent, rot);
            }
            if (Has("awning"))
            {
                var (nx, nz) = N(front);
                double span = front.Len * (Has("storefront") ? 0.75 : 0.35);
                var (ax, az) = P(front, -span / 2, 0.05);
                var (bx, bz) = P(front, span / 2, 0.05);
                double top = baseY + Math.Min(3.0, fh * 0.95);
                mb.Material(Tile.PLASTER, 0.5);
                mb.Panel(ax, top, az, bx, top, bz, bx + nx * 1.8, top - 0.55, bz + nz * 1.8, ax + nx * 1.8, top - 0.55, az + nz * 1.8, accent);
                mb.Box((ax + bx) / 2 + nx * 1.8, top - 0.85, (az + bz) / 2 + nz * 1.8, frontIsZ ? span : 0.08, 0.3, frontIsZ ? 0.08 : span, M.Shade(accent, 0.8), rot);
            }
            if (Has("sign") && !Has("falsefront"))
            {
                mb.Material(Tile.WOOD, 0.5);
                var (nx, nz) = N(front);
                if (Has("storefront"))
                {
                    var (sx, sz) = P(front, 0, 0.1);
                    mb.WallQuad(sx, baseY + fh + 0.15, sz, front.Len * 0.6, 0.75, nx, nz, accent);
                }
                else
                {
                    double u = front.Len * 0.25;
                    var (sx, sz) = P(front, u, 0.6);
                    mb.Box(sx, baseY + 2.9, sz, frontIsZ ? 0.08 : 1.2, 0.7, frontIsZ ? 1.2 : 0.08, accent, rot);
                    var (bx2, bz2) = P(front, u, 0.3);
                    mb.Box(bx2, baseY + 3.6, bz2, frontIsZ ? 0.08 : 0.7, 0.08, frontIsZ ? 0.7 : 0.08, IRON, rot);
                }
            }
            if (Has("ladder") && t.Stilts)
            {
                mb.Material(Tile.WOOD, 0.6);
                var (nx, nz) = N(front);
                var (ax, az) = P(front, -0.45, 0.3);
                var (bx, bz) = P(front, 0.45, 0.3);
                mb.Panel(ax, baseY, az, bx, baseY, bz, bx + nx * 1.4, groundY, bz + nz * 1.4, ax + nx * 1.4, groundY, az + nz * 1.4, M.Shade(wall, 0.7));
                var (lx, lz) = P(front, 0, 0.3);
                extra.Add(Collision.Ramp(lx + nx * 1.4, lz + nz * 1.4, groundY, lx, lz, baseY, 0.9, "ladder"));
            }
        }

        var (doorX, doorZ) = P(front, 0, 1.2);
        double pad = Has("arcade") || Has("porch") || Has("veranda") ? 0 : 0;
        return new BuiltBuilding { X = x, Z = z, Hw = w / 2 + 0.15 + pad, Hd = d / 2 + 0.15 + pad, Rot = rot, H = h, Tag = t.Tag, Template = t, DoorX = doorX, DoorZ = doorZ, Extra = extra };
    }

    static (double, double) WindowSize(string style, double fh)
    {
        switch (style)
        {
            case "tall": return (1.0, Math.Min(1.8, fh * 0.55));
            case "square": return (1.1, 1.1);
            case "slit": return (0.5, 1.0);
            case "arch": return (1.1, Math.Min(2.0, fh * 0.6));
            case "wide": return (2.0, Math.Min(1.5, fh * 0.45));
            case "shoji": return (1.5, 1.2);
            case "none": return (0, 0);
            // the TS switch has no default (WindowStyle is a closed union)
            default: return (0, 0);
        }
    }

    /// <summary>Windows, doors, sills, frames, shutters and storefronts on every face.</summary>
    static void Windows(
        MeshBuilder mb,
        Face[] faces,
        Func<Face, (double, double)> N,
        Func<Face, double, double, (double, double)> P,
        double y,
        int floors,
        double fh,
        BuildingTemplate t,
        int accent,
        int wall,
        Func<double, double> insetAt,
        Func<Face, bool> isFront,
        int firstFloor)
    {
        string style = t.Windows ?? "square";
        var (winW, winH) = WindowSize(style, fh);
        int glass = t.WindowColor ?? (style == "shoji" ? 0xf0e8d0 : DARK_WINDOW);
        double spacing = style == "wide" ? 3.2 : style == "slit" ? 1.6 : 2.3;
        bool battered = t.Has("battered");
        bool arcade = t.Has("arcade");
        bool storefront = t.Has("storefront");
        bool frames = t.Has("frames");
        bool sills = t.Has("sills");
        bool shutters = t.Has("shutters");
        foreach (var f in faces)
        {
            bool front = isFront(f);
            var (nx, nz) = N(f);
            double n = Math.Max(1, Math.Floor((f.Len - 0.8) / spacing));
            double step = f.Len / n;
            for (int fl = 0; fl < floors; fl++)
            {
                bool groundFloor = fl == 0 && firstFloor == 0;
                if (groundFloor && arcade && front) continue;
                double wy = y + fl * fh + fh * 0.3;
                // on battered walls the opening must clear the slope at its top edge
                double inset = insetAt(wy + winH + 0.3) + (battered ? 0.02 : 0);
                if (groundFloor && front && storefront)
                {
                    // big shop windows either side of a door
                    mb.Material(Tile.CONCRETE, 0.3);
                    double paneW = f.Len * 0.3;
                    foreach (int s in new[] { -1, 1 })
                    {
                        var (px, pz) = P(f, s * f.Len * 0.26, 0.06 - inset);
                        mb.WallQuad(px, y + 0.5, pz, paneW, Math.Min(2.3, fh * 0.72), nx, nz, 0x26343a);
                        mb.WallQuad(px, y + 0.42, pz, paneW + 0.24, Math.Min(2.46, fh * 0.78), nx, nz, accent);
                    }
                    var (sdx, sdz) = P(f, 0, 0.06 - inset);
                    mb.WallQuad(sdx, y + 0.02, sdz, 1.3, Math.Min(2.3, fh * 0.75), nx, nz, DARK_WINDOW);
                    continue;
                }
                if (style == "none")
                {
                    if (groundFloor && front)
                    {
                        mb.Material(Tile.WOOD, 0.6);
                        var (dx, dz) = P(f, 0, 0.05 - inset);
                        mb.WallQuad(dx, y + 0.02, dz, 1.2, Math.Min(2.1, fh * 0.75), nx, nz, 0x3a2a1a);
                    }
                    continue;
                }
                for (int i = 0; i < n; i++)
                {
                    double u = -f.Len / 2 + (i + 0.5) * step;
                    bool isDoor = front && groundFloor && i == Math.Floor(n / 2);
                    if (isDoor)
                    {
                        mb.Material(Tile.WOOD, 0.6);
                        var (dx, dz) = P(f, u, 0.05 - inset);
                        double dh = Math.Min(2.2, fh * 0.75);
                        if (frames) mb.WallQuad(dx, y + 0.02, dz, 1.5, dh + 0.2, nx, nz, accent);
                        var (dx2, dz2) = P(f, u, 0.08 - inset);
                        if (battered) mb.Box(dx2, y + 0.02, dz2, 1.2, dh, 0.6, 0x2a1e14, Math.Atan2(nz, nx) - Math.PI / 2);
                        else mb.WallQuad(dx2, y + 0.02, dz2, 1.2, dh, nx, nz, 0x2a1e14);
                        continue;
                    }
                    mb.Material(Tile.CONCRETE, 0.3);
                    if (frames)
                    {
                        var (qx, qz) = P(f, u, 0.04 - inset);
                        if (style == "arch") mb.ArchQuad(qx, wy - 0.12, qz, winW + 0.26, winH + 0.26, nx, nz, accent);
                        else mb.WallQuad(qx, wy - 0.12, qz, winW + 0.26, winH + 0.24, nx, nz, accent);
                    }
                    var (px2, pz2) = P(f, u, 0.07 - inset);
                    if (battered)
                    {
                        // a sloped wall would swallow a flat quad; a shallow dark box always shows a recess
                        mb.Box(px2, wy, pz2, f.AlongX ? winW : 0.5, winH, f.AlongX ? 0.5 : winW, glass, Math.Atan2(nz, nx) - Math.PI / 2 + (f.AlongX ? 0 : 0));
                    }
                    else if (style == "arch") mb.ArchQuad(px2, wy, pz2, winW, winH, nx, nz, glass);
                    else mb.WallQuad(px2, wy, pz2, winW, winH, nx, nz, glass);
                    if (style == "shoji")
                    {
                        // dark crossbars
                        mb.WallQuad(px2 + nx * 0.01, wy + winH * 0.5 - 0.04, pz2 + nz * 0.01, winW, 0.08, nx, nz, accent);
                        mb.WallQuad(px2 + nx * 0.01, wy, pz2 + nz * 0.01, 0.08, winH, nx, nz, accent);
                    }
                    // boxes aligned with the face: long side along the face, thin side along its normal
                    double faceRot = Math.Atan2(nz, nx) - Math.PI / 2;
                    if (sills)
                    {
                        mb.Material(Tile.STONE, 0.5);
                        var (sx, sz) = P(f, u, 0.12 - inset);
                        mb.Box(sx, wy - 0.14, sz, winW + 0.4, 0.14, 0.3, M.Shade(wall, 0.8), faceRot);
                    }
                    if (shutters)
                    {
                        mb.Material(Tile.WOOD, 0.8);
                        foreach (int s in new[] { -1, 1 })
                        {
                            var (hx, hz) = P(f, u + s * (winW / 2 + 0.25), 0.1 - inset);
                            mb.Box(hx, wy, hz, 0.4, winH, 0.08, accent, faceRot);
                        }
                    }
                }
            }
        }
    }

    static void AddRoof(MeshBuilder mb, BuildingTemplate t, double x, double y, double z, double w, double d, double rot, int roofColor, int wall, int floors, bool wing, int roofTex)
    {
        double ov = t.Overhang ?? 0.35;
        bool alongX = w >= d;
        mb.Material(roofTex, TexRepeat(roofTex));
        switch (t.Roof)
        {
            case "flat":
                if (t.Parapet)
                {
                    mb.Material(t.Tex ?? Tile.PLASTER, TexRepeat(t.Tex ?? Tile.PLASTER));
                    mb.Box(x, y - 0.1, z, w + 0.3, 0.6, d + 0.3, M.Shade(wall, 0.85), rot);
                    mb.Material(roofTex, 0.3);
                    mb.Box(x, y - 0.2, z, w - 0.3, 0.25, d - 0.3, roofColor, rot);
                }
                else mb.Box(x, y, z, w + 0.1, 0.25, d + 0.1, roofColor, rot);
                if (!wing && floors >= 4)
                {
                    mb.Material(Tile.CONCRETE, 0.4);
                    mb.Box(x, y, z, Math.Min(3, w * 0.3), 1.6, Math.Min(3, d * 0.3), M.Shade(wall, 0.9), rot);
                }
                break;
            case "gable":
            {
                double rh = Math.Min(w, d) * 0.38;
                if (alongX) mb.Prism(x, y - 0.05, z, w + ov * 2, rh, d + ov * 2, roofColor, rot);
                else mb.Prism(x, y - 0.05, z, d + ov * 2, rh, w + ov * 2, roofColor, rot + Math.PI / 2);
                break;
            }
            case "thatch":
            {
                double rh = Math.Min(w, d) * 0.5;
                double o = Math.Max(ov, 0.7);
                if (alongX) mb.Prism(x, y - 0.3, z, w + o * 2, rh, d + o * 2, roofColor, rot);
                else mb.Prism(x, y - 0.3, z, d + o * 2, rh, w + o * 2, roofColor, rot + Math.PI / 2);
                break;
            }
            case "hip":
            {
                double rh = Math.Min(w, d) * 0.32;
                mb.Hip(x, y - 0.05, z, w + ov * 2, rh, d + ov * 2, alongX ? w * 0.45 : w * 0.1, alongX ? d * 0.1 : d * 0.45, roofColor, rot);
                break;
            }
            case "pyramid":
                mb.Hip(x, y - 0.05, z, w + ov * 2, Math.Min(w, d) * 0.5, d + ov * 2, 0, 0, roofColor, rot);
                break;
            case "dome":
                mb.Dome(x, y - 0.1, z, Math.Min(w, d) / 2, roofColor, 12, 4);
                break;
            case "pagoda":
            {
                int tiers = Math.Max(2, floors);
                double fh = t.FloorHeight;
                for (int i = 0; i < tiers; i++)
                {
                    double ty = y - (tiers - i) * fh + fh * 0.95;
                    double o = 1.2 + i * 0.1;
                    double shrink = 1 - i * 0.12;
                    mb.Hip(x, ty, z, w * shrink + o * 2, 1.1, d * shrink + o * 2, w * shrink, d * shrink, roofColor, rot);
                }
                mb.Hip(x, y - 0.1, z, w * 0.75 + 1.6, Math.Min(w, d) * 0.45, d * 0.75 + 1.6, 0, 0, roofColor, rot);
                break;
            }
            case "stepped":
            {
                mb.Material(Tile.STONE, 0.4);
                mb.Box(x, y, z, w * 0.8, 1.6, d * 0.8, roofColor, rot);
                mb.Box(x, y + 1.6, z, w * 0.55, 1.4, d * 0.55, roofColor, rot);
                mb.Box(x, y + 3, z, w * 0.3, 1.2, d * 0.3, M.Shade(roofColor, 0.9), rot);
                break;
            }
            case "none":
                break;
        }
    }
}
