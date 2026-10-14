using System;
using System.Collections.Generic;
using Godot;

namespace Chronopolis;

// Types shared between the game loop, quests, NPCs and the UI.

/// <summary>A quest giver or inspectable object placed by the quest system (TS QuestNpcSpec).</summary>
public sealed class QuestNpcSpec
{
    public string Id;
    public string Name;
    public string Role;
    public double X, Z;
    public NpcArchetype Look;
    /// <summary>"npc" = a person, "object" = something to inspect (a tablet, a notice).</summary>
    public string Kind;
}

/// <summary>Where the tracked objective is (TS Marker).</summary>
public sealed class Marker
{
    public double X, Z;
    public string Era;
    public string Label;
    public string QuestId;
}

/// <summary>A chronoport pin on the minimap.</summary>
public struct PortPin
{
    public double X, Z;
    public bool Found;
}

public sealed class QuestState
{
    public List<string> Completed { get; set; } = new();
    public Dictionary<string, int> StepIndex { get; set; } = new();
}

/// <summary>What the quest manager can see of the game (TS QuestContext).</summary>
public interface IQuestContext
{
    string EraId { get; }
    double PlayerX { get; }
    double PlayerZ { get; }
    HashSet<string> Discovered { get; }
    HashSet<string> Insights { get; }
    HashSet<string> Flags { get; }
    HashSet<string> Hints { get; }
    void Notify(string text);
    void OnQuestsChanged();
}

/// <summary>Everything the journal screen shows (TS JournalData).</summary>
public sealed class JournalData
{
    public Era Era;
    public Texture2D MapImage;
    public double PlayerX, PlayerZ, PlayerYaw;
    public Marker Marker;
    public HashSet<string> Discovered;
    public HashSet<string> Hints;
    public HashSet<string> Insights;
    public QuestManager Quests;
}
