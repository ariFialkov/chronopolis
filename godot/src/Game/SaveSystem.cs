using System.Collections.Generic;
using System.Text.Json;
using Godot;

namespace Chronopolis;

public sealed class SaveData
{
    public int Version { get; set; } = 1;
    public string Era { get; set; }
    public double X { get; set; }
    public double Z { get; set; }
    public double Yaw { get; set; }
    public double CamYaw { get; set; }
    public List<string> Discovered { get; set; } = new();
    public List<string> Hints { get; set; } = new();
    public List<string> Insights { get; set; } = new();
    public List<string> Flags { get; set; } = new();
    public QuestState Quests { get; set; } = new();
    public double Playtime { get; set; }
    public string Quality { get; set; }
    public long SavedAt { get; set; }
}

/// <summary>Save game and settings in the user data folder (user://).</summary>
public static class SaveSystem
{
    const string SAVE = "user://save_v1.json";
    const string SETTINGS = "user://settings.json";
    static readonly JsonSerializerOptions Opts = new() { PropertyNameCaseInsensitive = true, WriteIndented = true };

    public static SaveData Load()
    {
        try
        {
            if (!FileAccess.FileExists(SAVE)) return null;
            var d = JsonSerializer.Deserialize<SaveData>(FileAccess.GetFileAsString(SAVE), Opts);
            return d != null && d.Version == 1 ? d : null;
        }
        catch { return null; }
    }

    public static bool Write(SaveData d)
    {
        using var f = FileAccess.Open(SAVE, FileAccess.ModeFlags.Write);
        if (f == null) return false;
        f.StoreString(JsonSerializer.Serialize(d, Opts));
        return true;
    }

    public static void Clear()
    {
        if (FileAccess.FileExists(SAVE)) DirAccess.RemoveAbsolute(ProjectSettings.GlobalizePath(SAVE));
    }

    public static string LoadQuality()
    {
        try
        {
            if (!FileAccess.FileExists(SETTINGS)) return null;
            var d = JsonSerializer.Deserialize<Dictionary<string, string>>(FileAccess.GetFileAsString(SETTINGS));
            return d != null && d.TryGetValue("quality", out var q) && (q == "low" || q == "medium" || q == "high" || q == "ultra") ? q : null;
        }
        catch { return null; }
    }

    public static void SaveQuality(string q)
    {
        using var f = FileAccess.Open(SETTINGS, FileAccess.ModeFlags.Write);
        f?.StoreString(JsonSerializer.Serialize(new Dictionary<string, string> { ["quality"] = q }));
    }
}
