using System;
using System.Collections.Generic;
using Godot;
using static Chronopolis.CharacterBuilder;

namespace Chronopolis;

/// <summary>A rigged, animated person built from an outfit. One draw call.</summary>
public sealed class Character : IDisposable
{
    static StandardMaterial3D _material;
    static readonly Dictionary<string, ArrayMesh> GeoCache = new();

    /// <summary>The shared vertex-coloured material used by every character.</summary>
    public static StandardMaterial3D Material => _material ??= new StandardMaterial3D
    {
        VertexColorUseAsAlbedo = true,
        VertexColorIsSrgb = true,
        AlbedoColor = Colors.White,
        Roughness = 0.85f,
        Metallic = 0f,
        MetallicSpecular = 0.2f,
        DiffuseMode = BaseMaterial3D.DiffuseModeEnum.Lambert,
    };

    /// <summary>Position and rotate this node to place the character (it is `group` in the TS).</summary>
    public readonly Node3D Root;
    public readonly Skeleton3D Skeleton;
    public readonly MeshInstance3D Mesh;

    readonly Vector3[] _rot = new Vector3[BONE_COUNT]; // per-bone Euler XYZ, like three's bone.rotation
    double _phase;
    double _t = Random.Shared.NextDouble() * 10;
    readonly bool _longSkirt;

    public Character(Outfit outfit, string cacheKey = null)
    {
        ArrayMesh geo = null;
        if (cacheKey != null) GeoCache.TryGetValue(cacheKey, out geo);
        if (geo == null)
        {
            geo = BuildCharacterGeometry(outfit);
            if (cacheKey != null) GeoCache[cacheKey] = geo;
        }

        Root = new Node3D { Name = "Character" };
        Skeleton = new Skeleton3D { Name = "Skeleton" };
        Root.AddChild(Skeleton);
        var layout = BoneLayout(GetDims(outfit));
        for (int i = 0; i < layout.Length; i++)
        {
            var (parent, x, y, z) = layout[i];
            Skeleton.AddBone(BoneNames[i]);
            Vector3 rest;
            if (parent < 0)
            {
                rest = new Vector3((float)x, (float)y, (float)z);
            }
            else
            {
                var p = layout[parent];
                Skeleton.SetBoneParent(i, parent);
                rest = new Vector3((float)(x - p.X), (float)(y - p.Y), (float)(z - p.Z));
            }
            Skeleton.SetBoneRest(i, new Transform3D(Basis.Identity, rest));
            Skeleton.SetBonePosePosition(i, rest);
            Skeleton.SetBonePoseRotation(i, Quaternion.Identity);
            Skeleton.SetBonePoseScale(i, Vector3.One);
        }

        Mesh = new MeshInstance3D
        {
            Name = "Mesh",
            Mesh = geo,
            MaterialOverride = Material,
            CastShadow = GeometryInstance3D.ShadowCastingSetting.On,
        };
        Skeleton.AddChild(Mesh);
        Mesh.Skeleton = new NodePath("..");
        Mesh.Skin = Skeleton.CreateSkinFromRestTransforms();
        // skinned vertices move with the bones; keep the culling box generous
        Mesh.CustomAabb = new Aabb(new Vector3(-1.2f, -0.3f, -1.2f), new Vector3(2.4f, 2.8f, 2.4f));

        _longSkirt = outfit.Skirt != null && outfit.Skirt.Length > 0.6 && !outfit.Skirt.Open;
    }

    /// <summary>speed in m/s drives the walk cycle; standing still breathes and sways a little.</summary>
    public void Animate(double dt, double speed)
    {
        var b = _rot;
        _t += dt;
        _phase += dt * Math.Min(14, 1.2 + speed * 2.4);
        double amp = Math.Min(0.85, speed * 0.17);
        if (_longSkirt) amp *= 0.55;
        double s = Math.Sin(_phase) * amp;
        b[THIGH_L].X = (float)-s;
        b[THIGH_R].X = (float)s;
        b[SHIN_L].X = (float)(Math.Max(0, Math.Sin(_phase + 0.6)) * amp * 1.3);
        b[SHIN_R].X = (float)(Math.Max(0, Math.Sin(_phase + Math.PI + 0.6)) * amp * 1.3);
        double breathe = Math.Sin(_t * 1.7) * (1 - Math.Min(1, speed));
        b[UARM_L].X = (float)(s * 0.9);
        b[UARM_R].X = (float)(-s * 0.9);
        b[UARM_L].Z = (float)(0.07 + breathe * 0.015);
        b[UARM_R].Z = (float)(-0.07 - breathe * 0.015);
        b[FARM_L].X = (float)(-0.2 - amp * 0.35);
        b[FARM_R].X = (float)(-0.2 - amp * 0.35);
        double hipsY = 0.86 + Math.Abs(Math.Sin(_phase)) * amp * 0.05 - amp * 0.02;
        b[CHEST].Y = (float)(s * 0.18);
        b[CHEST].X = (float)(breathe * 0.02 + amp * 0.06);
        b[HEAD].Y = (float)(-s * 0.1);

        Skeleton.SetBonePosePosition(HIPS, new Vector3(0, (float)hipsY, 0));
        for (int i = 0; i < BONE_COUNT; i++) Skeleton.SetBonePoseRotation(i, EulerXYZ(b[i]));
    }

    /// <summary>three.js Euler order 'XYZ' (R = Rx * Ry * Rz) as a quaternion.</summary>
    public static Quaternion EulerXYZ(Vector3 e)
    {
        return new Quaternion(Vector3.Right, e.X) * new Quaternion(Vector3.Up, e.Y) * new Quaternion(Vector3.Back, e.Z);
    }

    /// <summary>Removes the character from the scene tree (the cached mesh stays shared).</summary>
    public void QueueFree()
    {
        if (GodotObject.IsInstanceValid(Root)) Root.QueueFree();
    }

    public void Dispose() => QueueFree();
}
