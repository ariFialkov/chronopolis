using System;
using System.Collections.Generic;

namespace Chronopolis;

// Port of src/quests/questManager.ts. QuestState, Marker, QuestNpcSpec and IQuestContext live in Game/Shared.cs.

public sealed class QuestManager
{
    public QuestState State = new();
    readonly IQuestContext _ctx;

    public QuestManager(IQuestContext ctx)
    {
        _ctx = ctx;
    }

    public void Load(QuestState s)
    {
        State = new QuestState
        {
            Completed = new List<string>(s.Completed ?? new List<string>()),
            StepIndex = new Dictionary<string, int>(s.StepIndex ?? new Dictionary<string, int>()),
        };
    }

    public bool IsAvailable(Quest q)
    {
        if (State.Completed.Contains(q.Id)) return false;
        foreach (var r in q.Requires ?? Array.Empty<string>())
            if (!State.Completed.Contains(r)) return false;
        if (q.RequiresInsights is int ri && ri != 0 && _ctx.Insights.Count < ri) return false;
        return true;
    }

    public List<Quest> Active
    {
        get
        {
            var o = new List<Quest>();
            foreach (var q in GameData.Campaign) if (IsAvailable(q)) o.Add(q);
            return o;
        }
    }

    public List<Quest> Completed
    {
        get
        {
            var o = new List<Quest>();
            foreach (var q in GameData.Campaign) if (State.Completed.Contains(q.Id)) o.Add(q);
            return o;
        }
    }

    public QuestStep CurrentStep(Quest q)
    {
        return q.Steps[State.StepIndex.TryGetValue(q.Id, out var i) ? i : 0];
    }

    /// <summary>The step the HUD tracks: the first active quest whose current step is in this era, else any.</summary>
    public Quest TrackedQuest()
    {
        var act = Active;
        if (act.Count == 0) return null;
        foreach (var q in act)
            if (StepEra(CurrentStep(q)) == _ctx.EraId) return q;
        return act[0];
    }

    public Marker MarkerFor(Quest q)
    {
        var s = CurrentStep(q);
        string eraId = StepEra(s);
        switch (s.Kind)
        {
            case "talk":
            case "read":
            case "goto":
                return new Marker { X = s.X, Z = s.Z, Era = eraId, Label = s.Kind == "goto" ? s.Label : s.Name, QuestId = q.Id };
            case "findPort":
            {
                var p = GameData.GetEra(s.Port).Chronoport;
                // only point to it once the hint is known
                if (!_ctx.Hints.Contains(s.Port) && !_ctx.Discovered.Contains(s.Port)) return null;
                return new Marker { X = p.X, Z = p.Z, Era = "industrial", Label = $"Chronoport ({GameData.GetEra(s.Port).YearLabel})", QuestId = q.Id };
            }
            case "travel":
            {
                // point to a usable port: in home era, the port to that era; elsewhere, the port home
                string target = s.Era == "industrial" ? _ctx.EraId : s.Era;
                var e = GameData.GetEra(target);
                if (e.Chronoport == null) return null;
                return new Marker { X = e.Chronoport.X, Z = e.Chronoport.Z, Era = _ctx.EraId, Label = "Chronoport", QuestId = q.Id };
            }
        }
        return null;
    }

    /// <summary>Quest NPCs and objects that should exist in the current era right now.</summary>
    public List<QuestNpcSpec> QuestNpcs()
    {
        var o = new List<QuestNpcSpec>();
        foreach (var q in Active)
        {
            var s = CurrentStep(q);
            if (s.Kind == "talk" && s.Era == _ctx.EraId)
            {
                // { ...DEFAULT_LOOK, ...(s.look ?? {}), role: s.role, lines: s.lines }
                var look = new NpcArchetype
                {
                    Role = s.Role,
                    Outfit = s.Look?.Outfit ?? "",
                    Weight = 1,
                    Names = Array.Empty<string>(),
                    Lines = s.Lines,
                };
                o.Add(new QuestNpcSpec { Id = s.NpcId, Name = s.Name, Role = s.Role, X = s.X, Z = s.Z, Kind = "npc", Look = look });
            }
            else if (s.Kind == "read" && s.Era == _ctx.EraId)
            {
                // { ...DEFAULT_LOOK, lines: s.lines }
                var look = new NpcArchetype
                {
                    Role = "",
                    Outfit = "",
                    Weight = 1,
                    Names = Array.Empty<string>(),
                    Lines = s.Lines,
                };
                o.Add(new QuestNpcSpec { Id = s.ObjectId, Name = s.Name, Role = "Inspect", X = s.X, Z = s.Z, Kind = "object", Look = look });
            }
        }
        return o;
    }

    /// <summary>Returns dialogue lines if this npc/object id belongs to an active step.</summary>
    public (string Speaker, string[] Lines, string QuestId)? LinesFor(string id)
    {
        foreach (var q in Active)
        {
            var s = CurrentStep(q);
            if (s.Kind == "talk" && s.NpcId == id) return (s.Name, s.Lines, q.Id);
            if (s.Kind == "read" && s.ObjectId == id) return (s.Name, s.Lines, q.Id);
        }
        return null;
    }

    /// <summary>Called when a quest talk/read dialogue finished.</summary>
    public void CompleteInteraction(string id)
    {
        foreach (var q in Active)
        {
            var s = CurrentStep(q);
            if ((s.Kind == "talk" && s.NpcId == id) || (s.Kind == "read" && s.ObjectId == id))
            {
                Advance(q);
                return;
            }
        }
    }

    /// <summary>Poll passive conditions (goto, findPort, travel).</summary>
    public void Update()
    {
        foreach (var q in Active)
        {
            var s = CurrentStep(q);
            bool done = false;
            if (s.Kind == "goto") done = s.Era == _ctx.EraId && M.Hypot(_ctx.PlayerX - s.X, _ctx.PlayerZ - s.Z) < s.Radius;
            else if (s.Kind == "findPort") done = _ctx.Discovered.Contains(s.Port);
            else if (s.Kind == "travel") done = _ctx.EraId == s.Era;
            if (done) Advance(q);
        }
    }

    void Advance(Quest q)
    {
        int i = (State.StepIndex.TryGetValue(q.Id, out var cur) ? cur : 0) + 1;
        if (i >= q.Steps.Length)
        {
            State.Completed.Add(q.Id);
            State.StepIndex.Remove(q.Id);
            if (!string.IsNullOrEmpty(q.Insight))
            {
                _ctx.Insights.Add(q.Insight);
                _ctx.Notify($"Insight: {GameData.GetEra(q.Insight).Insight.Title}");
            }
            foreach (var h in q.RevealHints ?? Array.Empty<string>())
            {
                _ctx.Hints.Add(h);
                _ctx.Notify($"Journal updated: a clue about the {GameData.GetEra(h).YearLabel} door");
            }
            foreach (var f in q.Flags ?? Array.Empty<string>()) _ctx.Flags.Add(f);
            _ctx.Notify(!string.IsNullOrEmpty(q.CompleteText) ? $"{q.Title} complete. {q.CompleteText}" : $"{q.Title} complete.");
            // newly unlocked quests
            foreach (var nq in GameData.Campaign)
            {
                if (IsAvailable(nq) && !State.StepIndex.ContainsKey(nq.Id))
                {
                    State.StepIndex[nq.Id] = 0;
                    _ctx.Notify($"New objective: {nq.Title}");
                }
            }
        }
        else
        {
            State.StepIndex[q.Id] = i;
            var ns = q.Steps[i];
            _ctx.Notify(ns.Objective);
        }
        _ctx.OnQuestsChanged();
    }

    /// <summary>Make sure initially available quests have a step index (new game).</summary>
    public void Init()
    {
        foreach (var q in GameData.Campaign)
            if (IsAvailable(q) && !State.StepIndex.ContainsKey(q.Id)) State.StepIndex[q.Id] = 0;
    }

    public static string StepEra(QuestStep s)
    {
        switch (s.Kind)
        {
            case "findPort":
                return "industrial";
            default:
                return s.Era;
        }
    }
}
