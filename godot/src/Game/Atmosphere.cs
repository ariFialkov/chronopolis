using System;
using Godot;

namespace Chronopolis;

/// <summary>Rendering presets. Higher tiers stream more of the city and turn on the expensive lighting.</summary>
public sealed class QualityPreset
{
    public string Name;
    public int NearRadius, FarRadius;
    public bool Shadows;
    public float ShadowDistance;
    public bool Ssao, Ssil, Ssr, Glow, Volumetric;
    public float Scale = 1;

    public static readonly string[] Order = { "low", "medium", "high", "ultra" };

    public static QualityPreset Get(string name) => name switch
    {
        "low" => new QualityPreset { Name = "low", NearRadius = 1, FarRadius = 3, Shadows = true, ShadowDistance = 80, Scale = 0.75f },
        "medium" => new QualityPreset { Name = "medium", NearRadius = 2, FarRadius = 4, Shadows = true, ShadowDistance = 140, Ssao = true, Glow = true },
        "ultra" => new QualityPreset { Name = "ultra", NearRadius = 4, FarRadius = 7, Shadows = true, ShadowDistance = 320, Ssao = true, Ssil = true, Ssr = true, Glow = true, Volumetric = true },
        _ => new QualityPreset { Name = "high", NearRadius = 3, FarRadius = 5, Shadows = true, ShadowDistance = 220, Ssao = true, Ssil = true, Glow = true },
    };
}

/// <summary>Sky, sun, fog and post-processing for the current era.</summary>
public partial class Atmosphere : Node3D
{
    public readonly DirectionalLight3D Sun;
    public readonly WorldEnvironment WorldEnv;
    readonly Godot.Environment _env;
    readonly ShaderMaterial _sky;
    static readonly Vector3 SunDir = new Vector3(0.45f, 0.8f, 0.3f).Normalized();
    Era _era;
    QualityPreset _q;

    public Atmosphere()
    {
        Name = "Atmosphere";
        _sky = new ShaderMaterial { Shader = GD.Load<Shader>("res://shaders/sky.gdshader") };
        _env = new Godot.Environment
        {
            BackgroundMode = Godot.Environment.BGMode.Sky,
            Sky = new Sky { SkyMaterial = _sky, RadianceSize = Sky.RadianceSizeEnum.Size256, ProcessMode = Sky.ProcessModeEnum.Realtime },
            AmbientLightSource = Godot.Environment.AmbientSource.Sky,
            ReflectedLightSource = Godot.Environment.ReflectionSource.Sky,
            TonemapMode = Godot.Environment.ToneMapper.Aces,
            TonemapExposure = 0.85f,
            TonemapWhite = 6.0f,
            FogEnabled = true,
            FogMode = Godot.Environment.FogModeEnum.Depth,
            FogSkyAffect = 0.0f,
            FogAerialPerspective = 0.15f,
            SsaoRadius = 1.4f,
            SsaoIntensity = 1.6f,
            SsaoPower = 1.4f,
            SsilRadius = 6f,
            SsilIntensity = 0.7f,
            GlowIntensity = 0.5f,
            GlowBloom = 0.04f,
            GlowHdrThreshold = 1.1f,
            AdjustmentEnabled = true,
            AdjustmentSaturation = 1.08f,
            AdjustmentContrast = 1.04f,
        };
        WorldEnv = new WorldEnvironment { Environment = _env };
        AddChild(WorldEnv);
        Sun = new DirectionalLight3D
        {
            Name = "Sun",
            DirectionalShadowMode = DirectionalLight3D.ShadowMode.Parallel4Splits,
            ShadowBias = 0.04f,
            ShadowNormalBias = 1.2f,
            ShadowBlur = 1.2f,
            DirectionalShadowBlendSplits = true,
            LightAngularDistance = 0.6f,
        };
        Sun.LookAtFromPosition(SunDir * 100, Vector3.Zero, Vector3.Up);
        AddChild(Sun);
    }

    public void SetEra(Era e)
    {
        _era = e;
        _sky.SetShaderParameter("zenith", M.Col(e.Sky));
        _sky.SetShaderParameter("horizon", M.Col(e.Horizon));
        _sky.SetShaderParameter("below", M.Col(e.Fog) * 0.9f);
        _sky.SetShaderParameter("sun_color", M.Col(e.Sun));
        _sky.SetShaderParameter("cloud_cover", (float)M.Clamp(0.35 + e.FogDensity * 60, 0.3, 0.65));
        Sun.LightColor = M.Col(e.Sun);
        Sun.LightEnergy = (float)(e.SunIntensity * 0.9);
        _env.AmbientLightSkyContribution = 1.0f;
        _env.AmbientLightEnergy = 0.8f;
        _env.FogLightColor = M.Col(e.Fog);
        ApplyFog();
    }

    public void ApplyQuality(QualityPreset q, Viewport vp)
    {
        _q = q;
        Sun.ShadowEnabled = q.Shadows;
        Sun.DirectionalShadowMaxDistance = q.ShadowDistance;
        _env.SsaoEnabled = q.Ssao;
        _env.SsilEnabled = q.Ssil;
        _env.SsrEnabled = q.Ssr;
        _env.GlowEnabled = q.Glow;
        _env.VolumetricFogEnabled = false;
        vp.Scaling3DScale = q.Scale;
        vp.Scaling3DMode = q.Scale < 1 ? Viewport.Scaling3DModeEnum.Fsr2 : Viewport.Scaling3DModeEnum.Bilinear;
        ApplyFog();
    }

    /// <summary>
    /// Matches the web version's exp-squared fog (1 - e^-(d*density)^2), and never lets the
    /// streamed edge of the city show: fog is fully in before the far chunk ring ends.
    /// </summary>
    void ApplyFog()
    {
        if (_era == null || _q == null) return;
        double eraEnd = 2.0 / Math.Max(1e-4, _era.FogDensity);
        double streamEnd = (_q.FarRadius + 0.4) * Macro.CHUNK_SIZE;
        _env.FogDepthBegin = 12;
        _env.FogDepthEnd = (float)Math.Min(eraEnd, streamEnd);
        _env.FogDepthCurve = 1.8f;
        _env.FogDensity = 1.0f;
    }
}
