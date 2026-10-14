using System;
using System.Collections.Generic;
using Godot;

namespace Chronopolis;

/// <summary>Row-major 3x4 affine matrix in double precision (three.js Matrix4 restricted to affine use).</summary>
public readonly struct Affine
{
    // rows: [m00 m01 m02 m03] [m10 m11 m12 m13] [m20 m21 m22 m23]
    readonly double[] _m;
    Affine(double[] m) { _m = m; }

    public static Affine Identity => new(new double[] { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0 });
    public static Affine Translation(double x, double y, double z) => new(new double[] { 1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z });

    /// <summary>three.js makeRotationFromEuler with order 'XYZ': R = Rx * Ry * Rz.</summary>
    public static Affine RotationXYZ(double x, double y, double z)
    {
        double a = Math.Cos(x), b = Math.Sin(x);
        double c = Math.Cos(y), d = Math.Sin(y);
        double e = Math.Cos(z), f = Math.Sin(z);
        double ae = a * e, af = a * f, be = b * e, bf = b * f;
        return new(new double[]
        {
            c * e, -c * f, d, 0,
            af + be * d, ae - bf * d, -b * c, 0,
            bf - ae * d, be + af * d, a * c, 0,
        });
    }

    public static Affine operator *(Affine p, Affine q)
    {
        var a = p._m;
        var b = q._m;
        var r = new double[12];
        for (int i = 0; i < 3; i++)
        {
            double a0 = a[i * 4], a1 = a[i * 4 + 1], a2 = a[i * 4 + 2], a3 = a[i * 4 + 3];
            r[i * 4] = a0 * b[0] + a1 * b[4] + a2 * b[8];
            r[i * 4 + 1] = a0 * b[1] + a1 * b[5] + a2 * b[9];
            r[i * 4 + 2] = a0 * b[2] + a1 * b[6] + a2 * b[10];
            r[i * 4 + 3] = a0 * b[3] + a1 * b[7] + a2 * b[11] + a3;
        }
        return new Affine(r);
    }

    public void Apply(ref double x, ref double y, ref double z)
    {
        var m = _m;
        double nx = m[0] * x + m[1] * y + m[2] * z + m[3];
        double ny = m[4] * x + m[5] * y + m[6] * z + m[7];
        double nz = m[8] * x + m[9] * y + m[10] * z + m[11];
        x = nx;
        y = ny;
        z = nz;
    }
}

/// <summary>Options for <see cref="Mesher.Box"/>.</summary>
public struct BoxOpt
{
    public double? TopW;
    public double? TopD;
    public double? LeanZ;
    public bool? Caps;
}

/// <summary>Options for <see cref="Mesher.Frustum"/>.</summary>
public struct FrustumOpt
{
    public bool? Top;
    public bool? Bottom;
    public Func<int, bool> Skip;
    public Func<int, int> ColorOf;
    public double? Phase;
}

/// <summary>
/// Builds flat-shaded, vertex-coloured geometry where every primitive is rigidly bound to one bone.
/// Coordinates are in the character's bind pose: feet at y = 0, facing +z.
/// </summary>
public sealed class Mesher
{
    readonly List<Vector3> _pos = new();
    readonly List<Vector3> _nrm = new();
    readonly List<Color> _col = new();
    readonly List<int> _si = new();
    readonly List<float> _sw = new();
    int _bone;
    int _c;
    Affine? _xf;
    /// <summary>emit both windings (open surfaces such as coat tails and capes)</summary>
    public bool DoubleSided;

    public Mesher SetBone(int b)
    {
        _bone = b;
        return this;
    }

    public Mesher Color(int hex)
    {
        _c = hex;
        return this;
    }

    /// <summary>Run `fn` with every emitted point transformed by `m` (applied after the primitive's own placement).</summary>
    public void Transform(Affine m, Action fn)
    {
        var prev = _xf;
        _xf = prev.HasValue ? prev.Value * m : m;
        fn();
        _xf = prev;
    }

    /// <summary>Rotate about a pivot (Euler XYZ) while building `fn`.</summary>
    public void Rotated(double px, double py, double pz, double rx, double ry, double rz, Action fn)
    {
        var m = Affine.Translation(px, py, pz) * Affine.RotationXYZ(rx, ry, rz) * Affine.Translation(-px, -py, -pz);
        Transform(m, fn);
    }

    public void Tri(double[] a, double[] b, double[] c)
    {
        Emit(a, b, c);
        if (DoubleSided) Emit(a, c, b);
    }

    void Emit(double[] a, double[] b, double[] c)
    {
        double ax = a[0], ay = a[1], az = a[2];
        double bx = b[0], by = b[1], bz = b[2];
        double cx = c[0], cy = c[1], cz = c[2];
        if (_xf.HasValue)
        {
            var xf = _xf.Value;
            xf.Apply(ref ax, ref ay, ref az);
            xf.Apply(ref bx, ref by, ref bz);
            xf.Apply(ref cx, ref cy, ref cz);
        }
        double ux = bx - ax, uy = by - ay, uz = bz - az;
        double wx = cx - ax, wy = cy - ay, wz = cz - az;
        double nx = uy * wz - uz * wy;
        double ny = uz * wx - ux * wz;
        double nz = ux * wy - uy * wx;
        double l = M.Hypot(nx, ny, nz);
        if (l < 1e-9) return;
        var n = new Vector3((float)(nx / l), (float)(ny / l), (float)(nz / l));
        var col = M.Col(_c);
        // Godot's front face is clockwise (three.js: counter-clockwise), so emit (A, C, B).
        _pos.Add(new Vector3((float)ax, (float)ay, (float)az));
        _pos.Add(new Vector3((float)cx, (float)cy, (float)cz));
        _pos.Add(new Vector3((float)bx, (float)by, (float)bz));
        for (int k = 0; k < 3; k++)
        {
            _nrm.Add(n);
            _col.Add(col);
            _si.Add(_bone); _si.Add(0); _si.Add(0); _si.Add(0);
            _sw.Add(1); _sw.Add(0); _sw.Add(0); _sw.Add(0);
        }
    }

    public void Quad(double[] a, double[] b, double[] c, double[] d)
    {
        Tri(a, b, c);
        Tri(a, c, d);
    }

    /// <summary>
    /// Box from y0 to y1 centred on (cx, cz). The top face can be scaled (taper) and shifted in z
    /// (lean), which makes torsos, limbs and hat crowns.
    /// </summary>
    public void Box(double cx, double y0, double y1, double cz, double w, double d, BoxOpt opt = default)
    {
        double hw = w / 2;
        double hd = d / 2;
        double tw = (opt.TopW ?? w) / 2;
        double td = (opt.TopD ?? d) / 2;
        double lz = opt.LeanZ ?? 0;
        double[] b0 = { cx - hw, y0, cz - hd };
        double[] b1 = { cx + hw, y0, cz - hd };
        double[] b2 = { cx + hw, y0, cz + hd };
        double[] b3 = { cx - hw, y0, cz + hd };
        double[] t0 = { cx - tw, y1, cz - td + lz };
        double[] t1 = { cx + tw, y1, cz - td + lz };
        double[] t2 = { cx + tw, y1, cz + td + lz };
        double[] t3 = { cx - tw, y1, cz + td + lz };
        if (opt.Caps != false)
        {
            Quad(t0, t3, t2, t1);
            Quad(b0, b1, b2, b3);
        }
        Quad(b3, b2, t2, t3);
        Quad(b1, b0, t0, t1);
        Quad(b2, b1, t1, t2);
        Quad(b0, b3, t3, t0);
    }

    /// <summary>Centred box (for small details).</summary>
    public void Cube(double cx, double cy, double cz, double w, double h, double d)
    {
        Box(cx, cy - h / 2, cy + h / 2, cz, w, d);
    }

    /// <summary>
    /// Elliptical frustum around the vertical axis. `Skip(i)` leaves segments out (open coat fronts);
    /// `ColorOf(i)` paints segments individually (stripes, strips).
    /// </summary>
    public void Frustum(double cx, double y0, double y1, double cz, double rx0, double rz0, double rx1, double rz1, int seg = 8, FrustumOpt opt = default)
    {
        double ph = opt.Phase ?? 0;
        double[] P(int i, double y, double rx, double rz)
        {
            double a = ph + ((double)i / seg) * Math.PI * 2;
            return new[] { cx + Math.Cos(a) * rx, y, cz + Math.Sin(a) * rz };
        }
        int baseColor = _c;
        for (int i = 0; i < seg; i++)
        {
            if (opt.Skip != null && opt.Skip(i)) continue;
            if (opt.ColorOf != null) _c = opt.ColorOf(i);
            var b0 = P(i, y0, rx0, rz0);
            var b1 = P(i + 1, y0, rx0, rz0);
            var t0 = P(i, y1, rx1, rz1);
            var t1 = P(i + 1, y1, rx1, rz1);
            Quad(b0, t0, t1, b1);
            if (opt.Top != false && rx1 > 0) Tri(new[] { cx, y1, cz }, t1, t0);
            if (opt.Bottom != false && rx0 > 0) Tri(new[] { cx, y0, cz }, b0, b1);
        }
        _c = baseColor;
    }

    /// <summary>Ellipsoid (or the upper part of one: lat0 = 0 gives a dome).</summary>
    public void Sphere(double cx, double cy, double cz, double rx, double ry, double rz, int seg = 8, int rings = 5, double lat0 = -Math.PI / 2, double lat1 = Math.PI / 2)
    {
        double[] P(int i, int j)
        {
            double lat = lat0 + ((lat1 - lat0) * j) / rings;
            double a = ((double)i / seg) * Math.PI * 2;
            return new[] { cx + Math.Cos(a) * Math.Cos(lat) * rx, cy + Math.Sin(lat) * ry, cz + Math.Sin(a) * Math.Cos(lat) * rz };
        }
        for (int j = 0; j < rings; j++)
        {
            for (int i = 0; i < seg; i++) Quad(P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j));
        }
    }

    public int Triangles => _pos.Count / 3;

    public ArrayMesh Build()
    {
        var arrays = new Godot.Collections.Array();
        arrays.Resize((int)Mesh.ArrayType.Max);
        arrays[(int)Mesh.ArrayType.Vertex] = _pos.ToArray();
        arrays[(int)Mesh.ArrayType.Normal] = _nrm.ToArray();
        arrays[(int)Mesh.ArrayType.Color] = _col.ToArray();
        arrays[(int)Mesh.ArrayType.Bones] = _si.ToArray();
        arrays[(int)Mesh.ArrayType.Weights] = _sw.ToArray();
        var mesh = new ArrayMesh();
        mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
        return mesh;
    }
}
