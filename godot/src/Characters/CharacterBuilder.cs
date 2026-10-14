using System;
using System.Collections.Generic;
using Godot;

namespace Chronopolis;

/// <summary>Shoulder, chest and hip proportions for a build.</summary>
public readonly struct Dims
{
    public readonly double Sx; // shoulder joint x
    public readonly double ChestTop; // chest width at the shoulders
    public readonly double ChestBot;
    public readonly double WaistTop;
    public readonly double WaistBot;
    public readonly double Pelvis;
    public readonly double LegX;

    public Dims(double sx, double chestTop, double chestBot, double waistTop, double waistBot, double pelvis, double legX)
    {
        Sx = sx;
        ChestTop = chestTop;
        ChestBot = chestBot;
        WaistTop = waistTop;
        WaistBot = waistBot;
        Pelvis = pelvis;
        LegX = legX;
    }
}

/// <summary>Port of character.ts geometry: every character is one shared body dressed from outfit pieces.</summary>
public static class CharacterBuilder
{
    /// <summary>Bone indices. The rig is the same for every character.</summary>
    public const int HIPS = 0;
    public const int SPINE = 1;
    public const int CHEST = 2;
    public const int HEAD = 3;
    public const int UARM_L = 4;
    public const int FARM_L = 5;
    public const int UARM_R = 6;
    public const int FARM_R = 7;
    public const int THIGH_L = 8;
    public const int SHIN_L = 9;
    public const int THIGH_R = 10;
    public const int SHIN_R = 11;
    public const int BONE_COUNT = 12;

    public static readonly string[] BoneNames =
    {
        "hips", "spine", "chest", "head", "upperarm_l", "forearm_l", "upperarm_r", "forearm_r",
        "thigh_l", "shin_l", "thigh_r", "shin_r",
    };

    const int EYE = 0x1a1410;
    const int LIP = 0x7a4436;

    public static Dims GetDims(Outfit o)
    {
        return o.Build == "f"
            ? new Dims(0.235, 0.42, 0.34, 0.33, 0.36, 0.4, 0.1)
            : new Dims(0.27, 0.5, 0.41, 0.39, 0.37, 0.38, 0.11);
    }

    /// <summary>Bone layout: (parent, x, y, z) in bind-pose world coordinates.</summary>
    public static (int Parent, double X, double Y, double Z)[] BoneLayout(Dims d)
    {
        return new (int, double, double, double)[]
        {
            (-1, 0, 0.86, 0),
            (HIPS, 0, 1.0, 0),
            (SPINE, 0, 1.2, 0),
            (CHEST, 0, 1.42, 0),
            (CHEST, d.Sx, 1.36, 0),
            (UARM_L, d.Sx, 1.1, 0),
            (CHEST, -d.Sx, 1.36, 0),
            (UARM_R, -d.Sx, 1.1, 0),
            (HIPS, d.LegX, 0.84, 0),
            (THIGH_L, d.LegX, 0.45, 0),
            (HIPS, -d.LegX, 0.84, 0),
            (THIGH_R, -d.LegX, 0.45, 0),
        };
    }

    /// <summary>Skirt hem height for a length (0 = mid-thigh, 1 = ankle).</summary>
    static double HemY(double length) => 0.62 - length * 0.54;

    static int Shade(int c, double f) => M.Shade(c, f);

    public static ArrayMesh BuildCharacterGeometry(Outfit o)
    {
        var m = new Mesher();
        var d = GetDims(o);
        int skin = o.Skin;
        int hair = o.Hair;
        int top = o.Coat != null ? o.Coat.Color : o.Vest != null ? o.Vest.Color : o.Armor != null ? o.Armor.Color : o.Toga != null ? o.Toga.Color : o.Top ?? skin;
        int shirt = o.Top ?? skin;
        int sleeve = o.Coat != null ? o.Coat.Color : o.SleeveColor ?? (o.Vest != null ? shirt : o.Top ?? skin);
        int lowerTorso = o.Overalls ?? top;
        int legColor = o.Overalls ?? o.Legs ?? skin;
        bool f = o.Build == "f";

        // ---------------- body ----------------
        m.SetBone(HIPS).Color(o.Overalls ?? o.Legs ?? (o.Skirt != null ? o.Skirt.Color : skin));
        m.Box(0, 0.76, 0.95, 0, d.Pelvis, 0.24, new BoxOpt { TopW = d.WaistBot, TopD = 0.23 });
        m.SetBone(SPINE).Color(lowerTorso);
        m.Box(0, 0.92, 1.1, 0, d.WaistBot, 0.23, new BoxOpt { TopW = d.WaistTop + 0.02, TopD = 0.235 });
        m.SetBone(CHEST).Color(top);
        m.Box(0, 1.08, 1.42, 0, d.ChestBot, 0.245, new BoxOpt { TopW = d.ChestTop, TopD = 0.235 });
        // shoulders: a rounded cap over each joint
        m.Box(0, 1.36, 1.44, 0, d.ChestTop + 0.02, 0.22, new BoxOpt { TopW = d.ChestTop - 0.12, TopD = 0.16 });
        if (o.Top == null && o.Armor == null && o.Coat == null && o.Vest == null && o.Toga == null && o.Overalls == null)
        {
            // bare chest: a hint of pecs and navel shading
            m.Color(Shade(skin, 0.9));
            m.Cube(0.08, 1.31, 0.124, 0.13, 0.08, 0.01);
            m.Cube(-0.08, 1.31, 0.124, 0.13, 0.08, 0.01);
        }
        // neckline: a V of skin (or undershirt) at the front
        if (!string.IsNullOrEmpty(o.Neck) && o.Top != null)
        {
            m.Color(o.NeckColor ?? skin);
            m.Rotated(0, 1.42, 0.12, 0, 0, 0, () =>
            {
                m.Box(0, 1.3, 1.42, 0.121, 0.03, 0.01, new BoxOpt { TopW = o.Neck == "wrap" ? 0.16 : 0.14 });
            });
        }
        // neck and head
        m.SetBone(HEAD).Color(skin);
        m.Box(0, 1.36, 1.5, 0.0, 0.12, 0.12);
        m.Sphere(0, 1.63, 0.01, 0.2, 0.215, 0.19, 10, 7);
        // ears, nose
        m.Color(Shade(skin, 0.94));
        m.Cube(0.198, 1.6, 0.0, 0.04, 0.08, 0.06);
        m.Cube(-0.198, 1.6, 0.0, 0.04, 0.08, 0.06);
        m.Cube(0, 1.585, 0.195, 0.045, 0.055, 0.04);
        // eyes, brows, mouth
        m.Color(EYE);
        m.Cube(0.072, 1.62, 0.183, 0.05, 0.065, 0.03);
        m.Cube(-0.072, 1.62, 0.183, 0.05, 0.065, 0.03);
        m.Color(0xffffff);
        m.Cube(0.082, 1.632, 0.195, 0.016, 0.018, 0.01);
        m.Cube(-0.062, 1.632, 0.195, 0.016, 0.018, 0.01);
        m.Color(Shade(hair, 0.9));
        m.Cube(0.075, 1.688, 0.178, 0.08, 0.022, 0.03);
        m.Cube(-0.075, 1.688, 0.178, 0.08, 0.022, 0.03);
        m.Color(f ? 0xa04a44 : LIP);
        m.Cube(0, 1.528, 0.172, 0.07, 0.016, 0.02);

        // arms
        foreach (int side in new[] { 1, -1 })
        {
            int ua = side > 0 ? UARM_L : UARM_R;
            int fa = side > 0 ? FARM_L : FARM_R;
            double x = d.Sx * side;
            string sl = o.Sleeves ?? (o.Coat != null ? "long" : o.Top == null ? "none" : "short");
            m.SetBone(ua).Color(sl == "none" ? skin : sl == "short" ? skin : sleeve);
            m.Box(x, 1.1, 1.38, 0, 0.12, 0.13, new BoxOpt { TopW = 0.14, TopD = 0.15 });
            if (sl == "short")
            {
                m.Color(sleeve);
                m.Box(x, 1.2, 1.4, 0, 0.15, 0.16, new BoxOpt { TopW = 0.16, TopD = 0.17 });
            }
            if (sl == "wide")
            {
                // hanging kimono sleeve
                m.Color(sleeve);
                m.Box(x + side * 0.02, 0.96, 1.38, -0.01, 0.2, 0.28, new BoxOpt { TopW = 0.17, TopD = 0.2 });
            }
            m.SetBone(fa).Color(sl == "long" || sl == "wide" ? sleeve : skin);
            m.Box(x, 0.86, 1.11, 0, 0.11, 0.115, new BoxOpt { TopW = 0.12, TopD = 0.125 });
            if ((sl == "long" || sl == "wide") && o.Cuff.HasValue)
            {
                m.Color(o.Cuff.Value);
                m.Box(x, 0.86, 0.91, 0, 0.13, 0.135);
            }
            if (o.Bracers.HasValue)
            {
                m.Color(o.Bracers.Value);
                m.Box(x, 0.88, 1.0, 0, 0.13, 0.135);
            }
            m.Color(skin);
            m.Box(x, 0.74, 0.87, 0.005, 0.1, 0.1, new BoxOpt { TopW = 0.11 });
            if (o.Armor?.Shoulders != null)
            {
                m.SetBone(ua).Color(o.Armor.Shoulders.Value);
                m.Box(x + side * 0.02, 1.27, 1.42, 0, 0.2, 0.2, new BoxOpt { TopW = 0.14, TopD = 0.16 });
            }
        }

        // legs
        foreach (int side in new[] { 1, -1 })
        {
            int th = side > 0 ? THIGH_L : THIGH_R;
            int sh = side > 0 ? SHIN_L : SHIN_R;
            double x = d.LegX * side;
            m.SetBone(th).Color(legColor);
            m.Box(x, 0.45, 0.86, 0, 0.16, 0.17, new BoxOpt { TopW = 0.18, TopD = 0.19 });
            m.SetBone(sh).Color(o.LegsKnee || o.Legs == null && o.Overalls == null ? skin : legColor);
            m.Box(x, 0.07, 0.47, 0, 0.13, 0.14, new BoxOpt { TopW = 0.155, TopD = 0.165 });
            if (o.LegsKnee && o.Legs != null)
            {
                // breeches gathered below the knee
                m.Color(Shade(legColor, 0.9));
                m.Box(x, 0.38, 0.45, 0, 0.165, 0.175);
            }
            if (o.Greaves.HasValue)
            {
                m.Color(o.Greaves.Value);
                m.Box(x, 0.14, 0.44, 0.005, 0.15, 0.16, new BoxOpt { TopW = 0.165, TopD = 0.17 });
            }
            // feet
            var ft = o.Feet;
            if (ft.Kind == "boot")
            {
                double h = ft.Height ?? 0.32;
                m.Color(ft.Color);
                m.Box(x, 0.06, h, 0, 0.15, 0.16, new BoxOpt { TopW = 0.165, TopD = 0.17 });
                m.Color(Shade(ft.Color, 0.8));
                m.Box(x, h - 0.04, h + 0.01, 0, 0.175, 0.185);
                m.Color(ft.Color);
                m.Box(x, 0, 0.09, 0.04, 0.14, 0.25);
            }
            else if (ft.Kind == "shoe")
            {
                m.Color(ft.Color);
                m.Box(x, 0, 0.085, 0.04, 0.135, 0.25);
            }
            else
            {
                m.Color(skin);
                m.Box(x, 0.015, 0.08, 0.04, 0.125, 0.23);
                if (ft.Kind == "sandal")
                {
                    m.Color(ft.Color);
                    m.Box(x, 0, 0.022, 0.04, 0.14, 0.25);
                    m.Box(x, 0.04, 0.065, 0.08, 0.135, 0.04);
                    m.Box(x, 0.085, 0.11, 0.0, 0.14, 0.15);
                }
            }
        }

        // ---------------- garments ----------------
        if (o.Overalls.HasValue)
        {
            m.SetBone(CHEST).Color(o.Overalls.Value);
            m.Box(0, 1.07, 1.3, 0.125, 0.27, 0.02);
            foreach (double sx in new[] { 0.1, -0.1 })
            {
                m.Box(sx, 1.28, 1.44, 0.122, 0.05, 0.02);
                m.Box(sx, 1.06, 1.44, -0.122, 0.05, 0.02);
                m.Color(0xc9a24a);
                m.Cube(sx, 1.29, 0.137, 0.035, 0.035, 0.01);
                m.Color(o.Overalls.Value);
            }
        }
        if (o.Armor != null)
        {
            m.SetBone(CHEST).Color(o.Armor.Trim ?? Shade(o.Armor.Color, 0.8));
            m.Box(0, 1.2, 1.235, 0, d.ChestBot + 0.035, 0.27);
            m.Box(0, 1.3, 1.335, 0, d.ChestBot + 0.06, 0.265);
            m.Color(Shade(o.Armor.Color, 1.12));
            m.Cube(0, 1.27, 0.128, 0.16, 0.18, 0.012);
        }
        if (o.Vest != null || o.Coat != null)
        {
            // the shirt (and vest) showing at the front opening
            m.SetBone(CHEST);
            if (o.Coat != null && o.Vest != null)
            {
                m.Color(o.Vest.Color);
                m.Box(0, 1.08, 1.4, 0.125, 0.2, 0.012, new BoxOpt { TopW = 0.15 });
            }
            m.Color(shirt);
            m.Box(0, 1.2, 1.42, 0.128, 0.09, 0.012, new BoxOpt { TopW = 0.13 });
            if (o.Coat?.Trim != null)
            {
                m.Color(o.Coat.Trim.Value);
                foreach (double sx in new[] { 0.13, -0.13 }) m.Box(sx, 1.08, 1.42, 0.124, 0.035, 0.012, new BoxOpt { TopW = 0.035 });
            }
            if (o.Vest != null && o.Coat == null)
            {
                m.SetBone(SPINE).Color(o.Vest.Color);
                m.Box(0, 0.93, 1.1, 0.0, d.WaistBot + 0.01, 0.24, new BoxOpt { TopW = d.WaistTop + 0.03 });
            }
        }
        if (o.Tie.HasValue)
        {
            m.SetBone(CHEST).Color(o.Tie.Value);
            m.Box(0, 1.17, 1.41, 0.136, 0.045, 0.012, new BoxOpt { TopW = 0.06 });
        }
        if (o.Collar.HasValue)
        {
            m.SetBone(CHEST).Color(o.Collar.Value);
            m.Frustum(0, 1.3, 1.46, 0, d.ChestTop / 2 + 0.07, 0.19, 0.12, 0.11, 12, new FrustumOpt { Bottom = false });
        }
        void SashStrip(int color, double side, double width)
        {
            m.SetBone(CHEST).Color(color);
            foreach (double z in new[] { 0.132, -0.132 })
            {
                m.Rotated(0, 1.18, z, 0, 0, side * 0.72, () =>
                {
                    m.Box(0, 0.86, 1.52, z, width, 0.016);
                });
            }
        }
        if (o.Toga != null)
        {
            // draped over the left shoulder, with a coloured border running across the chest
            m.SetBone(CHEST).Color(o.Toga.Color);
            m.Box(d.Sx * 0.65, 1.0, 1.45, 0, 0.17, 0.27, new BoxOpt { TopW = 0.15 });
            if (o.Toga.Trim.HasValue) SashStrip(o.Toga.Trim.Value, 1, 0.1);
        }
        if (o.Sash != null) SashStrip(o.Sash.Color, o.Sash.Side ?? 1, o.Sash.Width ?? 0.09);
        if (o.Cross.HasValue)
        {
            SashStrip(o.Cross.Value, 1, 0.065);
            SashStrip(o.Cross.Value, -1, 0.065);
        }
        if (o.Cape != null)
        {
            m.SetBone(CHEST).Color(o.Cape.Color);
            double bottom = 1.42 - (o.Cape.Length ?? 0) * 1.3;
            m.Box(0, bottom, 1.43, -0.155, d.ChestTop + 0.08, 0.025, new BoxOpt { TopW = d.ChestTop - 0.02, LeanZ = 0.03 });
        }

        // skirts and coat tails
        var skirts = new List<(Skirt S, double Top)>();
        if (o.Skirt != null) skirts.Add((o.Skirt, 0.98));
        if (o.Toga != null && o.Skirt == null) skirts.Add((new Skirt { Color = o.Toga.Color, Length = 0.75, Flare = 0.05 }, 0.98));
        if (o.Coat != null && (o.Coat.Length ?? 0) > 0) skirts.Add((new Skirt { Color = o.Coat.Color, Length = o.Coat.Length.Value, Flare = 0.05, Open = true, Hem = o.Coat.Trim }, 1.0));
        foreach (var (s, ty) in skirts)
        {
            m.SetBone(HIPS).Color(s.Color);
            double by = HemY(s.Length);
            double flare = s.Flare ?? 0.03;
            double rx0 = (f ? 0.22 : 0.215) + flare + s.Length * 0.05;
            double rz0 = 0.165 + flare * 0.8 + s.Length * 0.04;
            double rx1 = f ? 0.215 : 0.205;
            double rz1 = 0.14;
            int seg = s.Open ? 12 : 10;
            Func<int, bool> skip = s.Open ? i => Math.Abs(((i + 0.5) / seg) * Math.PI * 2 - Math.PI / 2) < 0.7 : null;
            m.DoubleSided = s.Open;
            int sColor = s.Color;
            int? alt = s.Alt;
            m.Frustum(0, by, ty, 0, rx0, rz0, rx1, rz1, seg, new FrustumOpt
            {
                Top = false,
                Bottom = !s.Open,
                Skip = skip,
                ColorOf = alt.HasValue ? i => (i % 2 != 0 ? alt.Value : sColor) : null,
            });
            void Ring(double y, double h, int color, double grow)
            {
                double t = (y - by) / (ty - by);
                double rx = rx0 + (rx1 - rx0) * t + grow;
                double rz = rz0 + (rz1 - rz0) * t + grow;
                m.Color(color);
                m.Frustum(0, y, y + h, 0, rx, rz, rx - 0.003, rz - 0.003, seg, new FrustumOpt { Top = false, Bottom = false, Skip = skip });
            }
            if (s.Hem.HasValue) Ring(by, 0.06, s.Hem.Value, 0.012);
            if (s.Bands != null)
            {
                int n = s.Bands.Length;
                for (int k = 0; k < n; k++) Ring(by + ((double)(k + 1) / (n + 1)) * (ty - by) * 0.75, 0.045, s.Bands[k], 0.012);
            }
            m.DoubleSided = false;
        }
        // belt (always one at the waist of a skirt so the hem of the torso never shows)
        int? beltColor = o.Belt ?? (o.Skirt != null ? Shade(o.Skirt.Color, 0.85) : null);
        if (beltColor.HasValue)
        {
            m.SetBone(HIPS).Color(beltColor.Value);
            m.Box(0, 0.93, 1.0, 0, d.WaistBot + 0.05, 0.27, new BoxOpt { TopW = d.WaistBot + 0.06, TopD = 0.275 });
            if (o.Buckle.HasValue)
            {
                m.Color(o.Buckle.Value);
                m.Cube(0, 0.965, 0.142, 0.08, 0.06, 0.015);
            }
        }
        if (o.Apron != null)
        {
            // hangs from the belt down the front of the skirt (or the legs), following its slope
            m.SetBone(HIPS).Color(o.Apron.Color);
            double ah = (o.Apron.Length ?? 0) * 0.62;
            double yb = 0.96 - ah;
            bool hasSk = o.Skirt != null || o.Toga != null;
            double skLength = o.Skirt != null ? o.Skirt.Length : 0.75;
            double? skFlare = o.Skirt != null ? o.Skirt.Flare : 0.05;
            double FrontZ(double y)
            {
                if (!hasSk) return 0.145;
                double sby = HemY(skLength);
                double srz0 = 0.165 + (skFlare ?? 0.03) * 0.8 + skLength * 0.04;
                double t = Math.Max(0, Math.Min(1, (y - sby) / (0.98 - sby)));
                return srz0 + (0.14 - srz0) * t + 0.014;
            }
            double w = o.Apron.Width ?? 0.2;
            double zb = FrontZ(yb);
            m.Box(0, yb, 0.97, zb, w, 0.012, new BoxOpt { TopW = w * 0.9, LeanZ = FrontZ(0.97) - zb });
            if (o.Apron.Trim.HasValue)
            {
                m.Color(o.Apron.Trim.Value);
                m.Box(0, yb, yb + 0.04, zb + 0.004, w + 0.01, 0.012);
            }
        }

        // things at the hip
        if (!string.IsNullOrEmpty(o.Hip))
        {
            int hc = o.HipColor ?? 0x4a3a2a;
            m.SetBone(HIPS).Color(hc);
            switch (o.Hip)
            {
                case "sword":
                    m.Rotated(d.Pelvis / 2 + 0.06, 0.95, 0.02, 0, 0, 0.3, () => m.Box(d.Pelvis / 2 + 0.06, 0.38, 0.95, 0.02, 0.06, 0.05));
                    m.Color(0xb8a050);
                    m.Cube(d.Pelvis / 2 + 0.12, 0.98, 0.02, 0.12, 0.025, 0.04);
                    break;
                case "katana":
                    m.Rotated(d.Pelvis / 2 + 0.05, 0.95, 0.05, -0.6, 0, 0.25, () => m.Box(d.Pelvis / 2 + 0.05, 0.25, 0.98, 0.05, 0.05, 0.045));
                    break;
                case "pouch":
                    m.Cube(-d.Pelvis / 2 - 0.02, 0.86, 0.06, 0.08, 0.12, 0.1);
                    break;
                case "satchel":
                    m.Cube(d.Pelvis / 2 + 0.04, 0.82, 0.02, 0.08, 0.2, 0.2);
                    break;
                case "tools":
                    m.Cube(d.Pelvis / 2 + 0.02, 0.88, 0.05, 0.06, 0.14, 0.1);
                    m.Color(0x8a8a8a);
                    m.Cube(-d.Pelvis / 2 - 0.02, 0.84, 0.04, 0.04, 0.2, 0.04);
                    break;
                case "holster":
                    m.SetBone(THIGH_R).Color(hc);
                    m.Cube(-d.LegX - 0.1, 0.72, 0.0, 0.06, 0.2, 0.11);
                    m.Color(0x3a3a3a);
                    m.Cube(-d.LegX - 0.1, 0.84, 0.0, 0.05, 0.06, 0.05);
                    break;
            }
        }

        // ---------------- hair and beard ----------------
        HairAndBeard(m, o);
        if (o.Hat != null) BuildHat(m, o.Hat);
        return m.Build();
    }

    static void HairAndBeard(Mesher m, Outfit o)
    {
        int hc = o.Hair;
        m.SetBone(HEAD).Color(hc);
        string style = o.HairStyle;
        if (style != "bald")
        {
            // a cap of hair tilted back so the hairline sits above the brows and the back covers the nape
            // (nearly spherical so the tilt never lets the scalp show through)
            m.Rotated(0, 1.635, 0.0, -0.62, 0, 0, () => m.Sphere(0, 1.635, 0.0, 0.226, 0.232, 0.228, 12, 4, -0.22, Math.PI / 2));
        }
        switch (style)
        {
            case "long":
            case "braid":
                m.Box(0, 1.28, 1.66, -0.13, 0.34, 0.12, new BoxOpt { TopW = 0.4, TopD = 0.16 });
                m.Box(0.185, 1.38, 1.64, -0.01, 0.07, 0.17);
                m.Box(-0.185, 1.38, 1.64, -0.01, 0.07, 0.17);
                if (style == "braid") m.Box(0, 0.95, 1.3, -0.17, 0.08, 0.07);
                break;
            case "shoulder":
                m.Box(0, 1.4, 1.66, -0.12, 0.36, 0.12, new BoxOpt { TopW = 0.4, TopD = 0.15 });
                m.Box(0.19, 1.47, 1.64, -0.01, 0.06, 0.16);
                m.Box(-0.19, 1.47, 1.64, -0.01, 0.06, 0.16);
                break;
            case "bob":
                m.Box(0, 1.48, 1.66, -0.1, 0.4, 0.16, new BoxOpt { TopW = 0.42 });
                m.Box(0.2, 1.5, 1.65, 0.0, 0.05, 0.18);
                m.Box(-0.2, 1.5, 1.65, 0.0, 0.05, 0.18);
                break;
            case "bun":
                m.Sphere(0, 1.72, -0.21, 0.09, 0.08, 0.08, 7, 4);
                break;
            case "buns":
                m.Sphere(0.13, 1.82, -0.05, 0.07, 0.07, 0.07, 7, 4);
                m.Sphere(-0.13, 1.82, -0.05, 0.07, 0.07, 0.07, 7, 4);
                break;
            case "topknot":
                m.Sphere(0, 1.89, -0.03, 0.075, 0.07, 0.075, 7, 4);
                break;
        }
        string beard = o.Beard ?? "none";
        if (beard == "none") return;
        m.Color(o.BeardColor ?? hc);
        m.Cube(0, 1.558, 0.19, 0.13, 0.03, 0.035);
        switch (beard)
        {
            case "goatee":
                m.Cube(0, 1.47, 0.155, 0.09, 0.08, 0.06);
                break;
            case "short":
                m.Box(0, 1.43, 1.515, 0.07, 0.28, 0.2, new BoxOpt { TopW = 0.36, TopD = 0.24 });
                break;
            case "full":
                m.Box(0, 1.38, 1.515, 0.07, 0.28, 0.21, new BoxOpt { TopW = 0.37, TopD = 0.24 });
                break;
            case "long":
                m.Box(0, 1.26, 1.515, 0.08, 0.18, 0.17, new BoxOpt { TopW = 0.36, TopD = 0.24 });
                break;
            case "square":
                m.Box(0, 1.22, 1.515, 0.08, 0.3, 0.19, new BoxOpt { TopW = 0.36, TopD = 0.24 });
                m.Color(Shade(o.BeardColor ?? hc, 0.7));
                m.Box(0, 1.3, 1.32, 0.08, 0.31, 0.2);
                m.Box(0, 1.39, 1.41, 0.08, 0.33, 0.21);
                break;
        }
    }

    static void BuildHat(Mesher m, Hat h)
    {
        m.SetBone(HEAD).Color(h.Color);
        int c2 = h.Color2 ?? Shade(h.Color, 0.75);
        void Band(double y0, double y1, double r, int color)
        {
            m.Color(color);
            m.Frustum(0, y0, y1, 0.0, r, r * 0.97, r * 0.99, r * 0.96, 12, new FrustumOpt { Top = false, Bottom = false });
        }
        void Dome(double y, double rx, double ry, double rz, int color, double lat0 = 0)
        {
            m.Color(color);
            m.Sphere(0, y, 0.0, rx, ry, rz, 10, 4, lat0, Math.PI / 2);
        }
        void Cone(double x, double y0, double y1, double z, double r, int color)
        {
            m.Color(color);
            m.Frustum(x, y0, y1, z, r, r, 0, 0, 6);
        }
        int[] sides = { 1, -1 };
        switch (h.Kind)
        {
            case "headband":
                Band(1.69, 1.75, 0.222, h.Color);
                break;
            case "skullcap":
                Dome(1.69, 0.228, 0.2, 0.222, h.Color, -0.15);
                if (h.Color2.HasValue) Band(1.67, 1.73, 0.232, h.Color2.Value);
                break;
            case "fez":
            {
                double ht = h.Size ?? 0.26;
                m.Color(h.Color);
                m.Frustum(0, 1.68, 1.68 + ht, 0, 0.205, 0.2, 0.19, 0.185, 12);
                if (h.Color2.HasValue) Band(1.68, 1.74, 0.212, h.Color2.Value);
                if (h.Color3.HasValue) Band(1.68 + ht - 0.05, 1.68 + ht, 0.195, h.Color3.Value);
                break;
            }
            case "spike":
                Dome(1.68, 0.235, 0.215, 0.228, h.Color, -0.1);
                Band(1.66, 1.71, 0.238, c2);
                Cone(0, 1.86, 2.02, 0, 0.045, h.Color2 ?? h.Color);
                break;
            case "crest":
                Dome(1.68, 0.235, 0.215, 0.23, h.Color, -0.1);
                m.Color(h.Color);
                m.Box(0.2, 1.48, 1.68, 0.06, 0.04, 0.15);
                m.Box(-0.2, 1.48, 1.68, 0.06, 0.04, 0.15);
                m.Color(c2);
                m.Box(0, 1.84, 2.08, -0.03, 0.07, 0.36, new BoxOpt { TopD = 0.44 });
                m.Box(0, 1.5, 1.86, -0.24, 0.06, 0.06);
                break;
            case "pschent":
                m.Color(h.Color);
                m.Frustum(0, 1.7, 2.1, 0, 0.21, 0.2, 0.15, 0.14, 10, new FrustumOpt { ColorOf = i => (i % 2 != 0 ? c2 : h.Color) });
                Band(1.69, 1.77, 0.222, h.Color3 ?? 0xd9a52a);
                break;
            case "horns":
                Band(1.69, 1.8, 0.224, h.Color);
                Dome(1.79, 0.2, 0.06, 0.19, h.Color);
                m.Color(c2);
                m.Cube(0, 1.86, 0, 0.5, 0.05, 0.06);
                foreach (int s in sides) m.Rotated(s * 0.24, 1.86, 0, 0, 0, -s * 0.35, () => m.Box(s * 0.24, 1.86, 2.08, 0, 0.05, 0.05, new BoxOpt { TopW = 0.03 }));
                break;
            case "wreath":
                m.Color(h.Color);
                for (int i = 0; i < 12; i++)
                {
                    double a = (i / 12.0) * Math.PI * 2;
                    double x = Math.Cos(a) * 0.218;
                    double z = Math.Sin(a) * 0.208;
                    m.Rotated(x, 1.74, z, 0, -a, 0.4, () => m.Cube(x, 1.74, z, 0.04, 0.05, 0.08));
                }
                break;
            case "athena":
                Dome(1.68, 0.235, 0.22, 0.23, h.Color, -0.15);
                Cone(0, 1.86, 2.04, 0, 0.05, h.Color);
                m.Color(h.Color);
                foreach (int s in sides) m.Rotated(s * 0.19, 1.8, 0, 0, 0, -s * 0.7, () => m.Box(s * 0.19, 1.8, 1.98, 0, 0.04, 0.04, new BoxOpt { TopW = 0.01 }));
                break;
            case "turban":
                m.Sphere(0, 1.73, 0, 0.25, 0.14, 0.245, 10, 4);
                m.Color(Shade(h.Color, 0.92));
                m.Sphere(0, 1.81, -0.01, 0.2, 0.1, 0.2, 10, 3);
                if (h.Color2.HasValue)
                {
                    m.Color(h.Color2.Value);
                    m.Cube(0, 1.75, 0.235, 0.06, 0.07, 0.03);
                }
                break;
            case "feathers":
            {
                double size = h.Size ?? 0.5;
                int n = 9 + (int)M.Round(size * 6);
                double spread = 1.0 + size * 0.45;
                double len = 0.2 + size * 0.32;
                for (int i = 0; i < n; i++)
                {
                    double a = -spread + (2 * spread * i) / (n - 1);
                    m.Color(i % 2 != 0 && h.Color3.HasValue ? h.Color3.Value : Shade(h.Color, 0.92 + (i % 3) * 0.06));
                    m.Rotated(0, 1.78, -0.1, -0.25, 0, a, () => m.Box(0, 1.78, 1.78 + len, -0.1, 0.075, 0.025, new BoxOpt { TopW = 0.1 }));
                }
                Band(1.68, 1.79, 0.228, c2);
                m.Color(c2);
                m.Cube(0, 1.76, 0.225, 0.09, 0.09, 0.03);
                break;
            }
            case "viking":
                Dome(1.68, 0.235, 0.22, 0.23, h.Color, -0.08);
                Band(1.66, 1.71, 0.24, c2);
                m.Color(h.Color);
                m.Box(0, 1.56, 1.7, 0.225, 0.04, 0.03);
                if (h.Spike) Cone(0, 1.86, 1.98, 0, 0.04, h.Color);
                if (h.Horns)
                {
                    m.Color(0xe8dcc0);
                    foreach (int s in sides)
                    {
                        m.Rotated(s * 0.2, 1.76, 0, 0, 0, -s * 1.0, () => m.Box(s * 0.2, 1.76, 1.94, 0, 0.06, 0.06, new BoxOpt { TopW = 0.045, TopD = 0.045 }));
                        m.Rotated(s * 0.35, 1.86, 0, 0, 0, -s * 0.15, () => m.Box(s * 0.35, 1.86, 2.0, 0, 0.045, 0.045, new BoxOpt { TopW = 0.015, TopD = 0.015 }));
                    }
                }
                break;
            case "mukuta":
                Band(1.68, 1.76, 0.226, h.Color);
                m.Color(h.Color);
                m.Frustum(0, 1.76, 1.91, 0, 0.19, 0.18, 0.11, 0.1, 10);
                m.Frustum(0, 1.91, 2.01, 0, 0.11, 0.1, 0.065, 0.06, 8);
                Cone(0, 2.01, 2.24, 0, 0.05, h.Color);
                foreach (int s in sides) m.Rotated(s * 0.17, 1.76, 0.02, 0, 0, -s * 0.35, () => Cone(s * 0.17, 1.76, 1.94, 0.02, 0.035, h.Color));
                Cone(0, 1.76, 1.93, 0.17, 0.035, h.Color);
                break;
            case "mongol":
                m.Color(h.Color);
                m.Frustum(0, 1.67, 1.79, 0, 0.23, 0.22, 0.27, 0.26, 12, new FrustumOpt { Top = false });
                Dome(1.77, 0.205, 0.15, 0.2, Shade(h.Color, 0.96));
                m.Color(c2);
                m.Sphere(0, 1.95, 0, 0.035, 0.035, 0.035, 6, 3);
                if (h.Horns)
                {
                    m.Color(h.Color);
                    foreach (int s in sides) m.Rotated(s * 0.14, 1.86, 0, 0, 0, -s * 0.6, () => m.Box(s * 0.14, 1.86, 2.0, 0, 0.035, 0.035, new BoxOpt { TopW = 0.01 }));
                }
                break;
            case "jingasa":
                Dome(1.76, 0.205, 0.11, 0.2, h.Color);
                m.Color(h.Color);
                m.Frustum(0, 1.74, 1.8, 0, 0.37, 0.36, 0.2, 0.195, 12, new FrustumOpt { Top = false });
                break;
            case "kasa":
                m.Frustum(0, 1.74, 2.02, 0, 0.47, 0.46, 0.02, 0.02, 12);
                break;
            case "kabuto":
                Dome(1.68, 0.245, 0.225, 0.24, h.Color, -0.1);
                m.DoubleSided = true;
                m.Frustum(0, 1.5, 1.7, 0, 0.36, 0.35, 0.245, 0.24, 12, new FrustumOpt { Top = false, Bottom = false, Skip = i => i == 2 || i == 3 });
                m.DoubleSided = false;
                m.Color(c2);
                m.Cube(0, 1.8, 0.215, 0.12, 0.07, 0.03);
                foreach (int s in sides)
                {
                    m.Rotated(s * 0.05, 1.8, 0.22, 0, 0, -s * 0.5, () => m.Box(s * 0.05, 1.8, 2.1, 0.22, 0.04, 0.03));
                    m.Rotated(s * 0.2, 2.06, 0.22, 0, 0, s * 0.9, () => m.Box(s * 0.2, 2.06, 2.16, 0.22, 0.035, 0.03));
                }
                break;
            case "tricorn":
                m.Color(h.Color);
                m.Frustum(0, 1.74, 1.88, 0, 0.205, 0.2, 0.18, 0.175, 10);
                m.Frustum(0, 1.76, 1.84, 0, 0.36, 0.36, 0.38, 0.38, 3, new FrustumOpt { Phase = Math.PI / 2 });
                if (h.Color2.HasValue)
                {
                    m.Color(h.Color2.Value);
                    m.Cube(0, 1.82, 0.27, 0.07, 0.07, 0.02);
                }
                break;
            case "bandana":
                Dome(1.69, 0.232, 0.19, 0.226, h.Color, -0.12);
                m.Cube(0, 1.66, -0.23, 0.1, 0.08, 0.06);
                break;
            case "tophat":
                m.Frustum(0, 1.76, 1.785, 0, 0.31, 0.3, 0.31, 0.3, 12);
                m.Frustum(0, 1.785, 2.11, 0, 0.195, 0.19, 0.205, 0.2, 12);
                Band(1.79, 1.84, 0.2, c2);
                break;
            case "bowler":
                m.Frustum(0, 1.76, 1.78, 0, 0.29, 0.28, 0.29, 0.28, 12);
                Dome(1.78, 0.2, 0.17, 0.2, h.Color);
                Band(1.78, 1.82, 0.202, c2);
                break;
            case "flatcap":
                m.Sphere(0, 1.79, 0.02, 0.235, 0.095, 0.245, 10, 4);
                m.Box(0, 1.755, 1.775, 0.2, 0.26, 0.12);
                break;
            case "cowboy":
                m.Frustum(0, 1.76, 1.79, 0, 0.42, 0.36, 0.42, 0.36, 12);
                foreach (int s in sides) m.Rotated(s * 0.36, 1.78, 0, 0, 0, s * 0.5, () => m.Box(s * 0.38, 1.77, 1.79, 0, 0.1, 0.5));
                m.Frustum(0, 1.79, 1.99, 0, 0.19, 0.17, 0.16, 0.14, 10);
                Band(1.79, 1.83, 0.192, c2);
                break;
            case "bonnet":
                Dome(1.7, 0.25, 0.22, 0.25, h.Color, -0.1);
                m.Color(h.Color);
                m.Frustum(0, 1.68, 1.71, 0, 0.32, 0.32, 0.3, 0.3, 12);
                if (h.Spike) Cone(0, 1.9, 1.96, 0, 0.03, h.Color);
                break;
            case "ladyhat":
                m.Frustum(0, 1.77, 1.79, 0, 0.28, 0.27, 0.28, 0.27, 12);
                m.Frustum(0, 1.79, 1.9, 0, 0.17, 0.165, 0.15, 0.145, 10);
                Band(1.79, 1.83, 0.172, c2);
                break;
            case "hood":
                m.Rotated(0, 1.63, 0.01, -0.45, 0, 0, () => m.Sphere(0, 1.63, 0, 0.245, 0.25, 0.235, 10, 4, -0.5, Math.PI / 2));
                m.Box(0, 1.36, 1.6, -0.13, 0.36, 0.12, new BoxOpt { TopW = 0.42 });
                break;
        }
        if (h.Goggles)
        {
            foreach (int s in sides)
            {
                m.Color(0xb88a3a);
                m.Rotated(s * 0.075, 1.82, 0.2, Math.PI / 2, 0, 0, () => m.Frustum(s * 0.075, 1.8, 1.84, 0.2, 0.045, 0.045, 0.045, 0.045, 8));
                m.Color(0x3a5a6a);
                m.Cube(s * 0.075, 1.82, 0.235, 0.05, 0.05, 0.01);
            }
        }
    }
}
