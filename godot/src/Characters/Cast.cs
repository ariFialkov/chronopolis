using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Chronopolis;

/// <summary>Helpers over the era cast (outfits are data in res://data/cast.json, see GameData.Cast).</summary>
public static class Cast
{
    public const int VARIANTS = 3;

    static readonly Regex SoldierRe = new("soldier|guard|warrior|legion|hoplite|raider|samurai|archer|captain|general|pirate|officer");
    static readonly Regex PriestRe = new("priest|monk|oracle|astronomer|shaman|vicar|preacher|scholar|scribe|senator|sage|historian|chaplain|skald");
    static readonly Regex MerchantRe = new("merchant|trader|banker|official|noble|courtier|envoy|gentleman|king|governor|industrialist");
    static readonly Regex FarmerRe = new("farmer|peasant|herder|shepherd|laborer|worker|dockhand|deportee");
    static readonly Regex DoctorRe = new("doctor");
    static readonly Regex InventorRe = new("inventor|engineer");

    /// <summary>Pick the closest outfit for a role name when a story character has no explicit outfit.</summary>
    public static string OutfitKeyForRole(string eraId, string role)
    {
        string r = role.ToLowerInvariant();
        Dictionary<string, Outfit> roles = null;
        if (GameData.Cast != null && GameData.Cast.TryGetValue(eraId, out var ec)) roles = ec.Roles;
        bool Has(string k) => roles != null && roles.ContainsKey(k);
        if (SoldierRe.IsMatch(r)) return Has("soldier") ? "soldier" : Has("outlaw") ? "outlaw" : "merchant";
        if (PriestRe.IsMatch(r)) return "priest";
        if (MerchantRe.IsMatch(r)) return "merchant";
        if (FarmerRe.IsMatch(r)) return "farmer";
        if (DoctorRe.IsMatch(r) && Has("doctor")) return "doctor";
        if (InventorRe.IsMatch(r) && Has("inventor")) return "inventor";
        return Has("artisan") ? "artisan" : "merchant";
    }

    static readonly string[] Beards = { "none", "mustache", "short", "full" };

    /// <summary>
    /// A slightly different person in the same outfit: skin tone, hair and garment shades shift so a
    /// crowd of one role does not look cloned. Variant 0 is the sheet's look.
    /// </summary>
    public static Outfit VaryOutfit(Outfit o, int v)
    {
        if (v == 0) return o;
        double k = v == 1 ? 0.9 : 1.08;
        double skinK = v == 1 ? 0.92 : 1.05;
        int? Tint(int? c) => c.HasValue ? M.Shade(c.Value, k) : null;
        var output = o.Clone();
        output.Skin = M.Shade(o.Skin, skinK);
        output.Hair = v == 2 && o.Hair < 0x303030 ? 0x4a3020 : o.Hair;
        output.Top = Tint(o.Top);
        output.Legs = Tint(o.Legs);
        if (o.Skirt != null) output.Skirt.Color = M.Shade(o.Skirt.Color, k);
        if (o.Coat != null) output.Coat.Color = M.Shade(o.Coat.Color, k);
        if (o.Vest != null) output.Vest.Color = M.Shade(o.Vest.Color, k);
        if (o.Build != "f")
        {
            // swap facial hair between neighbours
            int idx = o.Beard != null ? Array.IndexOf(Beards, o.Beard) : -1;
            if (idx >= 0) output.Beard = Beards[(idx + v) % Beards.Length];
        }
        return output;
    }
}
