using System;
using System.Collections.Generic;
using Godot;

namespace Chronopolis;

public sealed class PortObject
{
    public Era Era;
    public Node3D Group;
    public MeshInstance3D Disc, Ring;
    public StandardMaterial3D DiscMaterial;
    public OmniLight3D Light;
}

/// <summary>The chronoports: ancient rings that exist in every era at the same spot.</summary>
public partial class ChronoportManager : Node3D
{
    public const double NOTICE_RADIUS = 20;
    public const double USE_RADIUS = 3.2;
    public readonly List<PortObject> Ports = new();
    double _time;

    public ChronoportManager(World world)
    {
        Name = "Chronoports";
        var stone = new StandardMaterial3D { AlbedoColor = M.Col(0x6a6460), Roughness = 0.9f };
        var ringMat = new StandardMaterial3D { AlbedoColor = M.Col(0x8a8078), Roughness = 0.6f, Metallic = 0.2f };
        foreach (var era in GameData.ChronoportEras)
        {
            var p = era.Chronoport;
            var group = new Node3D { Name = $"Port_{era.Id}" };
            group.AddChild(new MeshInstance3D
            {
                Mesh = new CylinderMesh { TopRadius = 3.2f, BottomRadius = 3.6f, Height = 0.5f, RadialSegments = 24 },
                MaterialOverride = stone,
                Position = new Vector3(0, 0.25f, 0),
            });
            var ring = new MeshInstance3D
            {
                Mesh = new TorusMesh { InnerRadius = 2.1f - 0.32f, OuterRadius = 2.1f + 0.32f, Rings = 48, RingSegments = 16 },
                MaterialOverride = ringMat,
                Position = new Vector3(0, 2.7f, 0),
                // three.js tori stand upright in the XY plane; Godot's lie flat in XZ
                Rotation = new Vector3(Mathf.Pi / 2, 0, 0),
            };
            group.AddChild(ring);
            for (int i = 0; i < 4; i++)
            {
                double a = i / 4.0 * Math.PI * 2 + Math.PI / 4;
                group.AddChild(new MeshInstance3D
                {
                    Mesh = new CylinderMesh { TopRadius = 0.28f, BottomRadius = 0.34f, Height = 3.4f, RadialSegments = 10 },
                    MaterialOverride = stone,
                    Position = new Vector3((float)(Math.Cos(a) * 3.0), 2.2f, (float)(Math.Sin(a) * 3.0)),
                });
            }
            var discMat = new StandardMaterial3D
            {
                AlbedoColor = new Color(M.Col(0x6ad0ff), 0.55f),
                Transparency = BaseMaterial3D.TransparencyEnum.Alpha,
                ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded,
                EmissionEnabled = true,
                Emission = M.Col(0x6ad0ff),
                EmissionEnergyMultiplier = 2.5f,
                CullMode = BaseMaterial3D.CullModeEnum.Disabled,
            };
            var disc = new MeshInstance3D
            {
                Mesh = new CylinderMesh { TopRadius = 1.8f, BottomRadius = 1.8f, Height = 0.05f, RadialSegments = 32 },
                MaterialOverride = discMat,
                Position = new Vector3(0, 2.7f, 0),
                Rotation = new Vector3(Mathf.Pi / 2, 0, 0),
                CastShadow = GeometryInstance3D.ShadowCastingSetting.Off,
            };
            group.AddChild(disc);
            var light = new OmniLight3D { Position = new Vector3(0, 2.7f, 0), OmniRange = 9, LightColor = M.Col(0x6ad0ff), LightEnergy = 2.0f, ShadowEnabled = false };
            group.AddChild(light);
            group.Position = new Vector3((float)p.X, (float)world.GroundY(p.X, p.Z), (float)p.Z);
            AddChild(group);
            Ports.Add(new PortObject { Era = era, Group = group, Disc = disc, Ring = ring, DiscMaterial = discMat, Light = light });
        }
    }

    public void RefreshHeights(World world)
    {
        foreach (var p in Ports)
        {
            var pos = p.Group.Position;
            pos.Y = (float)world.GroundY(p.Era.Chronoport.X, p.Era.Chronoport.Z);
            p.Group.Position = pos;
        }
    }

    /// <summary>Whether a port is live in the given era: home era, or the port's own era.</summary>
    public static bool IsActive(PortObject port, Era currentEra, string homeEraId) => currentEra.Id == homeEraId || currentEra.Id == port.Era.Id;

    public void Step(double dt, Era currentEra, string homeEraId)
    {
        _time += dt;
        foreach (var p in Ports)
        {
            bool active = IsActive(p, currentEra, homeEraId);
            var col = M.Col(active ? 0x6ad0ff : 0x445566);
            col.A = (float)(active ? 0.45 + 0.2 * Math.Sin(_time * 2.5) : 0.08);
            p.DiscMaterial.AlbedoColor = col;
            p.DiscMaterial.EmissionEnergyMultiplier = active ? 2.5f : 0.1f;
            p.Light.Visible = active;
            p.Disc.RotateObjectLocal(Vector3.Up, (float)(dt * (active ? 0.8 : 0.05)));
            p.Ring.RotateObjectLocal(Vector3.Forward, (float)(dt * 0.2));
        }
    }

    public PortObject Nearest(double px, double pz, double radius)
    {
        PortObject best = null;
        double bd = radius;
        foreach (var p in Ports)
        {
            double d = M.Hypot(p.Era.Chronoport.X - px, p.Era.Chronoport.Z - pz);
            if (d < bd)
            {
                bd = d;
                best = p;
            }
        }
        return best;
    }
}
