using System.Collections.Generic;

namespace Chronopolis;

public sealed class Lot
{
    public double X, Z, W, D;
    /// <summary>rotation of the building (radians, about Y)</summary>
    public double Rot;
    /// <summary>direction the front faces, radians</summary>
    public double Front;
    public double Seed;
    /// <summary>distance-based build probability modifier</summary>
    public double Weight;
}

public sealed class StreetNode
{
    public double X, Z;
    public string Key;
}

public sealed class Park
{
    public double X, Z, W, D, Seed;
}

public sealed class Strip
{
    public List<P2> Points = new();
    public double Width;
    public int Layer;
}

/// <summary>An era's street pattern: pure functions of position, so chunks generate in any order.</summary>
public interface ICityPattern
{
    bool IsStreet(double x, double z);
    /// <summary>Blocks given over to parks or gardens inside the rect.</summary>
    List<Park> ParksInRect(double x0, double z0, double x1, double z1);
    bool IsPark(double x, double z);
    List<Lot> LotsInRect(double x0, double z0, double x1, double z1);
    /// <summary>Street strips to draw inside a rect: polylines with a width.</summary>
    List<Strip> StripsInRect(double x0, double z0, double x1, double z1);
    /// <summary>Navigation nodes (street intersections) for NPC wandering.</summary>
    List<StreetNode> NodesInRect(double x0, double z0, double x1, double z1);
    List<StreetNode> Neighbors(StreetNode node);
}
