using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Godot;

namespace Chronopolis;

// Data model: mirrors the JSON in res://data (exported from the original TypeScript content).
// Property names map case-insensitively, so `floorHeight` in JSON is FloorHeight here.

public sealed class BuildingTemplate
{
    public double Weight { get; set; }
    public int? Tex { get; set; }
    public double? TexRepeat { get; set; }
    public int? RoofTex { get; set; }
    public string[] Features { get; set; } = System.Array.Empty<string>();
    public string Windows { get; set; }
    public int? WindowColor { get; set; }
    public int? Accent { get; set; }
    public int[] Floors { get; set; } = { 1, 1 };
    public double FloorHeight { get; set; }
    public double[] Footprint { get; set; } = { 0.7, 0.9 };
    public string Roof { get; set; } = "flat";
    public int[] RoofColors { get; set; } = System.Array.Empty<int>();
    public int[] WallColors { get; set; } = System.Array.Empty<int>();
    public bool Columns { get; set; }
    public bool Chimney { get; set; }
    public bool Stilts { get; set; }
    public bool Round { get; set; }
    public bool Tower { get; set; }
    public bool Setback { get; set; }
    public bool Smokestack { get; set; }
    public bool Parapet { get; set; }
    public bool Courtyard { get; set; }
    public int? Trim { get; set; }
    public double? Overhang { get; set; }
    public bool Tent { get; set; }
    public string Tag { get; set; }

    HashSet<string> _f;
    public bool Has(string feature) => (_f ??= new HashSet<string>(Features ?? System.Array.Empty<string>())).Contains(feature);
}

public sealed class EraLayout
{
    public string Pattern { get; set; }
    public double BlockW { get; set; }
    public double BlockD { get; set; }
    public double StreetWidth { get; set; }
    public double Curve { get; set; }
    public double CurveLen { get; set; }
    public double LotSize { get; set; }
    public double Density { get; set; }
    public double Extent { get; set; }
    public bool Fields { get; set; }
    public bool Walls { get; set; }
    public bool PavedArterials { get; set; }
}

public sealed class NpcArchetype
{
    public string Role { get; set; } = "";
    public string Outfit { get; set; } = "";
    public double Weight { get; set; } = 1;
    public string[] Names { get; set; } = System.Array.Empty<string>();
    public string[] Lines { get; set; } = System.Array.Empty<string>();
}

public sealed class ChronoportInfo
{
    public double X { get; set; }
    public double Z { get; set; }
    public string PlaceName { get; set; }
    public string Hint { get; set; }
}

public sealed class EraLandmarks
{
    public string Citadel { get; set; }
    public string Harbor { get; set; }
    public string Arena { get; set; }
    public string Plaza { get; set; }
    public string Sacred { get; set; }
    public string Market { get; set; }

    public string ForSite(string site) => site switch
    {
        "citadel" => Citadel,
        "harbor" => Harbor,
        "arena" => Arena,
        "plaza" => Plaza,
        "sacred" => Sacred,
        "market" => Market,
        _ => null,
    };
}

public sealed class Insight
{
    public string Title { get; set; }
    public string Text { get; set; }
}

public sealed class Era
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Civ { get; set; }
    public int Year { get; set; }
    public string YearLabel { get; set; }
    public string Tagline { get; set; }
    public int Sky { get; set; }
    public int Horizon { get; set; }
    public int Fog { get; set; }
    public double FogDensity { get; set; }
    public int Sun { get; set; }
    public double SunIntensity { get; set; }
    public int Ambient { get; set; }
    public int Ground { get; set; }
    public int Road { get; set; }
    public int Dirt { get; set; }
    public int Water { get; set; }
    public EraLayout Layout { get; set; }
    public BuildingTemplate[] Buildings { get; set; }
    public string[] Props { get; set; }
    public double PropDensity { get; set; }
    public string Trees { get; set; }
    public double TreeDensity { get; set; }
    public EraLandmarks Landmarks { get; set; }
    public NpcArchetype[] Npcs { get; set; }
    public double NpcDensity { get; set; }
    public string Ships { get; set; }
    public ChronoportInfo Chronoport { get; set; }
    public Dictionary<string, string> DistrictNames { get; set; }
    public string Lore { get; set; }
    public Insight Insight { get; set; }
}

public sealed class Surfaces
{
    public int Road { get; set; }
    public int RoadColor { get; set; }
    public int MinorRoad { get; set; }
    public int MinorRoadColor { get; set; }
    public bool LaneMarks { get; set; }
    public int LaneColor { get; set; }
    public int Core { get; set; }
    public int CoreColor { get; set; }
    public int Outskirts { get; set; }
    public int OutskirtsColor { get; set; }
    public int Plaza { get; set; }
    public int PlazaColor { get; set; }
    public string Park { get; set; }
    public double ParkChance { get; set; }
    public int ParkTile { get; set; }
    public int ParkColor { get; set; }
    public int PathTile { get; set; }
    public int PathColor { get; set; }
    public bool Canals { get; set; }
}

// ---------- characters ----------

public sealed class Hat
{
    public string Kind { get; set; }
    public int Color { get; set; }
    public int? Color2 { get; set; }
    public int? Color3 { get; set; }
    public double? Size { get; set; }
    public bool Horns { get; set; }
    public bool Spike { get; set; }
    public bool Goggles { get; set; }
}

public sealed class Skirt
{
    public int Color { get; set; }
    public double Length { get; set; }
    public double? Flare { get; set; }
    public int? Hem { get; set; }
    public int[] Bands { get; set; }
    public int? Alt { get; set; }
    public bool Open { get; set; }
    public Skirt Clone() => (Skirt)MemberwiseClone();
}

public sealed class Feet
{
    public string Kind { get; set; }
    public int Color { get; set; }
    public double? Height { get; set; }
}

public sealed class ColorPiece
{
    public int Color { get; set; }
    public int? Side { get; set; }
    public double? Width { get; set; }
    public double? Length { get; set; }
    public int? Trim { get; set; }
    public int? Shoulders { get; set; }
    public ColorPiece Clone() => (ColorPiece)MemberwiseClone();
}

public sealed class Outfit
{
    public string Build { get; set; } = "m";
    public int Skin { get; set; }
    public int Hair { get; set; }
    public string HairStyle { get; set; } = "short";
    public string Beard { get; set; }
    public int? BeardColor { get; set; }
    public int? Top { get; set; }
    public string Neck { get; set; }
    public int? NeckColor { get; set; }
    public string Sleeves { get; set; }
    public int? SleeveColor { get; set; }
    public int? Cuff { get; set; }
    public int? Legs { get; set; }
    public bool LegsKnee { get; set; }
    public Skirt Skirt { get; set; }
    public Feet Feet { get; set; } = new() { Kind = "bare", Color = 0 };
    public int? Belt { get; set; }
    public int? Buckle { get; set; }
    public ColorPiece Sash { get; set; }
    public int? Cross { get; set; }
    public ColorPiece Toga { get; set; }
    public ColorPiece Apron { get; set; }
    public int? Collar { get; set; }
    public ColorPiece Cape { get; set; }
    public ColorPiece Vest { get; set; }
    public ColorPiece Coat { get; set; }
    public int? Overalls { get; set; }
    public int? Tie { get; set; }
    public ColorPiece Armor { get; set; }
    public int? Greaves { get; set; }
    public int? Bracers { get; set; }
    public Hat Hat { get; set; }
    public string Hip { get; set; }
    public int? HipColor { get; set; }

    public Outfit Clone()
    {
        var o = (Outfit)MemberwiseClone();
        o.Skirt = Skirt?.Clone();
        o.Coat = Coat?.Clone();
        o.Vest = Vest?.Clone();
        return o;
    }
}

public sealed class EraCast
{
    public Outfit Player { get; set; }
    public Dictionary<string, Outfit> Roles { get; set; }
}

// ---------- quests ----------

public sealed class QuestLook
{
    public string Outfit { get; set; }
}

public sealed class QuestStep
{
    public string Kind { get; set; }
    public string Era { get; set; }
    public string NpcId { get; set; }
    public string ObjectId { get; set; }
    public string Name { get; set; }
    public string Role { get; set; }
    public double X { get; set; }
    public double Z { get; set; }
    public double Radius { get; set; }
    public string[] Lines { get; set; } = System.Array.Empty<string>();
    public QuestLook Look { get; set; }
    public string Objective { get; set; }
    public string Label { get; set; }
    public string Port { get; set; }
}

public sealed class Quest
{
    public string Id { get; set; }
    public int Act { get; set; }
    public string Title { get; set; }
    public string Summary { get; set; }
    public string[] Requires { get; set; } = System.Array.Empty<string>();
    public int? RequiresInsights { get; set; }
    public QuestStep[] Steps { get; set; }
    public string Insight { get; set; }
    public string[] RevealHints { get; set; }
    public string[] Flags { get; set; }
    public string CompleteText { get; set; }
}

sealed class ErasFile
{
    public string Home { get; set; }
    public Era[] Eras { get; set; }
}

/// <summary>All game content, loaded once from res://data.</summary>
public static class GameData
{
    public static Era[] Eras { get; private set; }
    public static string HomeEraId { get; private set; }
    public static Dictionary<string, Surfaces> Surfaces { get; private set; }
    public static Dictionary<string, EraCast> Cast { get; private set; }
    public static Quest[] Campaign { get; private set; }
    public static Era[] ChronoportEras { get; private set; }
    static Dictionary<string, Era> _byId;

    static readonly JsonSerializerOptions Opts = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    static T Read<T>(string path)
    {
        string text = FileAccess.GetFileAsString(path);
        if (string.IsNullOrEmpty(text)) throw new System.Exception($"Missing data file {path}");
        return JsonSerializer.Deserialize<T>(text, Opts);
    }

    public static void Load()
    {
        if (Eras != null) return;
        var ef = Read<ErasFile>("res://data/eras.json");
        Eras = ef.Eras.OrderBy(e => e.Year).ToArray();
        HomeEraId = ef.Home;
        _byId = Eras.ToDictionary(e => e.Id);
        Surfaces = Read<Dictionary<string, Surfaces>>("res://data/surfaces.json");
        Cast = Read<Dictionary<string, EraCast>>("res://data/cast.json");
        Campaign = Read<Quest[]>("res://data/campaign.json");
        ChronoportEras = Eras.Where(e => e.Chronoport != null).ToArray();
    }

    public static Era GetEra(string id) => _byId.TryGetValue(id, out var e) ? e : throw new System.Exception($"Unknown era {id}");
    public static Quest GetQuest(string id) => Campaign.FirstOrDefault(q => q.Id == id);
}
