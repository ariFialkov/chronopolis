using System;
using Godot;

namespace Chronopolis;

/// <summary>
/// Accumulates flat-shaded, vertex-coloured, atlas-textured triangles into one mesh (one draw call
/// per chunk). Same API as the original TypeScript MeshBuilder. Triangles are given counter-clockwise
/// seen from outside (as in the original); they are emitted clockwise because that is Godot's front face.
/// Safe to fill on a worker thread; call ToMesh() on any thread to create the ArrayMesh.
/// </summary>
public sealed class MeshBuilder
{
    Vector3[] _pos = new Vector3[1024];
    Vector3[] _nrm = new Vector3[1024];
    Color[] _col = new Color[1024];
    Vector2[] _uv = new Vector2[1024];
    Vector2[] _uv2 = new Vector2[1024];
    int _n;

    float _r = 1, _g = 1, _b = 1;
    int _tile = Tile.PLASTER;
    double _uvScale = 0.5;
    /// <summary>Per-vertex colour override used by gradient faces (bottom darkening).</summary>
    Color[] _vcol;

    public int TriangleCount => _n / 3;
    public bool IsEmpty => _n == 0;

    /// <summary>Choose the atlas tile and texture density (repeats per metre) for the geometry that follows.</summary>
    public void Material(int tile, double repeatsPerMeter = 0.5)
    {
        _tile = tile;
        _uvScale = repeatsPerMeter;
    }

    public void SetColor(int hex)
    {
        _r = ((hex >> 16) & 255) / 255f;
        _g = ((hex >> 8) & 255) / 255f;
        _b = (hex & 255) / 255f;
    }

    void Grow()
    {
        int cap = _pos.Length * 2;
        Array.Resize(ref _pos, cap);
        Array.Resize(ref _nrm, cap);
        Array.Resize(ref _col, cap);
        Array.Resize(ref _uv, cap);
        Array.Resize(ref _uv2, cap);
    }

    public void Tri(double ax, double ay, double az, double bx, double by, double bz, double cx, double cy, double cz)
    {
        double ux = bx - ax, uy = by - ay, uz = bz - az;
        double vx = cx - ax, vy = cy - ay, vz = cz - az;
        double nx = uy * vz - uz * vy;
        double ny = uz * vx - ux * vz;
        double nz = ux * vy - uy * vx;
        double len = Math.Sqrt(nx * nx + ny * ny + nz * nz);
        if (len == 0) len = 1;
        nx /= len;
        ny /= len;
        nz /= len;
        if (_n + 3 > _pos.Length) Grow();
        var n = new Vector3((float)nx, (float)ny, (float)nz);
        // planar UV projection on the dominant axis of the face normal
        double s = _uvScale;
        double anx = Math.Abs(nx), any = Math.Abs(ny), anz = Math.Abs(nz);
        Vector2 ua, ub, uc;
        if (any >= anx && any >= anz)
        {
            ua = new((float)(ax * s), (float)(az * s));
            ub = new((float)(bx * s), (float)(bz * s));
            uc = new((float)(cx * s), (float)(cz * s));
        }
        else if (anx >= anz)
        {
            ua = new((float)(az * s), (float)(ay * s));
            ub = new((float)(bz * s), (float)(by * s));
            uc = new((float)(cz * s), (float)(cy * s));
        }
        else
        {
            ua = new((float)(ax * s), (float)(ay * s));
            ub = new((float)(bx * s), (float)(by * s));
            uc = new((float)(cx * s), (float)(cy * s));
        }
        Color ca, cb, cc;
        if (_vcol != null)
        {
            ca = _vcol[0];
            cb = _vcol[1];
            cc = _vcol[2];
        }
        else ca = cb = cc = new Color(_r, _g, _b);
        var t = new Vector2(_tile, 0);
        // emitted a, c, b: clockwise is the front face in Godot
        int i = _n;
        _pos[i] = new Vector3((float)ax, (float)ay, (float)az); _nrm[i] = n; _col[i] = ca; _uv[i] = ua; _uv2[i] = t;
        _pos[i + 1] = new Vector3((float)cx, (float)cy, (float)cz); _nrm[i + 1] = n; _col[i + 1] = cc; _uv[i + 1] = uc; _uv2[i + 1] = t;
        _pos[i + 2] = new Vector3((float)bx, (float)by, (float)bz); _nrm[i + 2] = n; _col[i + 2] = cb; _uv[i + 2] = ub; _uv2[i + 2] = t;
        _n += 3;
    }

    public void Quad(double ax, double ay, double az, double bx, double by, double bz, double cx, double cy, double cz, double dx, double dy, double dz)
    {
        Tri(ax, ay, az, bx, by, bz, cx, cy, cz);
        Tri(ax, ay, az, cx, cy, cz, dx, dy, dz);
    }

    /// <summary>Quad whose bottom two vertices are darkened (cheap ambient occlusion at the ground).</summary>
    void ShadedSide(double ax, double ay, double az, double bx, double by, double bz, double cx, double cy, double cz, double dx, double dy, double dz, double k)
    {
        var top = new Color(_r, _g, _b);
        var bot = new Color((float)(_r * k), (float)(_g * k), (float)(_b * k));
        _vcol = new[] { bot, top, top };
        Tri(ax, ay, az, bx, by, bz, cx, cy, cz);
        _vcol = new[] { bot, top, bot };
        Tri(ax, ay, az, cx, cy, cz, dx, dy, dz);
        _vcol = null;
    }

    /// <summary>Box, optionally rotated about Y around its own centre. y is the bottom.</summary>
    public void Box(double cx, double y, double cz, double w, double h, double d, int color, double rot = 0, double bottomShade = 1)
    {
        SetColor(color);
        double hw = w / 2, hd = d / 2, c = Math.Cos(rot), s = Math.Sin(rot);
        double x0 = cx - hw * c + hd * s, z0 = cz - hw * s - hd * c;
        double x1 = cx + hw * c + hd * s, z1 = cz + hw * s - hd * c;
        double x2 = cx + hw * c - hd * s, z2 = cz + hw * s + hd * c;
        double x3 = cx - hw * c - hd * s, z3 = cz - hw * s + hd * c;
        double y1 = y + h;
        Quad(x0, y1, z0, x3, y1, z3, x2, y1, z2, x1, y1, z1);
        if (bottomShade < 1)
        {
            ShadedSide(x0, y, z0, x0, y1, z0, x1, y1, z1, x1, y, z1, bottomShade);
            ShadedSide(x1, y, z1, x1, y1, z1, x2, y1, z2, x2, y, z2, bottomShade);
            ShadedSide(x2, y, z2, x2, y1, z2, x3, y1, z3, x3, y, z3, bottomShade);
            ShadedSide(x3, y, z3, x3, y1, z3, x0, y1, z0, x0, y, z0, bottomShade);
        }
        else
        {
            Quad(x0, y, z0, x0, y1, z0, x1, y1, z1, x1, y, z1);
            Quad(x1, y, z1, x1, y1, z1, x2, y1, z2, x2, y, z2);
            Quad(x2, y, z2, x2, y1, z2, x3, y1, z3, x3, y, z3);
            Quad(x3, y, z3, x3, y1, z3, x0, y1, z0, x0, y, z0);
        }
    }

    /// <summary>Vertical rectangle centred at (cx, y+h/2, cz), width w, facing (nx, nz).</summary>
    public void WallQuad(double cx, double y, double cz, double w, double h, double nx, double nz, int color)
    {
        SetColor(color);
        double len = M.Hypot(nx, nz);
        if (len == 0) len = 1;
        double tx = (-nz / len) * (w / 2), tz = (nx / len) * (w / 2);
        Quad(cx - tx, y, cz - tz, cx - tx, y + h, cz - tz, cx + tx, y + h, cz + tz, cx + tx, y, cz + tz);
    }

    /// <summary>Arched opening: rectangle with a semicircular top, facing (nx, nz).</summary>
    public void ArchQuad(double cx, double y, double cz, double w, double h, double nx, double nz, int color)
    {
        double r = w / 2;
        double rectH = Math.Max(0.1, h - r);
        WallQuad(cx, y, cz, w, rectH, nx, nz, color);
        SetColor(color);
        double len = M.Hypot(nx, nz);
        if (len == 0) len = 1;
        double tx = -nz / len, tz = nx / len;
        double yc = y + rectH;
        const int n = 6;
        for (int i = 0; i < n; i++)
        {
            double a0 = (double)i / n * Math.PI, a1 = (double)(i + 1) / n * Math.PI;
            Tri(cx, yc, cz,
                cx + tx * Math.Cos(a0) * r, yc + Math.Sin(a0) * r, cz + tz * Math.Cos(a0) * r,
                cx + tx * Math.Cos(a1) * r, yc + Math.Sin(a1) * r, cz + tz * Math.Cos(a1) * r);
        }
    }

    /// <summary>Double-sided quad from four corners (awnings, sloped panels).</summary>
    public void Panel(double ax, double ay, double az, double bx, double by, double bz, double cx, double cy, double cz, double dx, double dy, double dz, int color)
    {
        SetColor(color);
        Quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
        Quad(dx, dy, dz, cx, cy, cz, bx, by, bz, ax, ay, az);
    }

    /// <summary>Flat quad on the ground (y up).</summary>
    public void GroundQuad(double x0, double z0, double x1, double z1, double x2, double z2, double x3, double z3, double y, int color)
    {
        SetColor(color);
        Quad(x0, y, z0, x3, y, z3, x2, y, z2, x1, y, z1);
    }

    /// <summary>Gable roof: triangular prism, ridge along local x.</summary>
    public void Prism(double cx, double y, double cz, double w, double h, double d, int color, double rot = 0)
    {
        SetColor(color);
        double hw = w / 2, hd = d / 2, c = Math.Cos(rot), s = Math.Sin(rot);
        (double, double) P(double lx, double lz) => (cx + lx * c - lz * s, cz + lx * s + lz * c);
        var (x0, z0) = P(-hw, -hd);
        var (x1, z1) = P(hw, -hd);
        var (x2, z2) = P(hw, hd);
        var (x3, z3) = P(-hw, hd);
        var (rx0, rz0) = P(-hw, 0);
        var (rx1, rz1) = P(hw, 0);
        double y1 = y + h;
        Quad(x0, y, z0, rx0, y1, rz0, rx1, y1, rz1, x1, y, z1);
        Quad(x2, y, z2, rx1, y1, rz1, rx0, y1, rz0, x3, y, z3);
        Tri(x1, y, z1, rx1, y1, rz1, x2, y, z2);
        Tri(x3, y, z3, rx0, y1, rz0, x0, y, z0);
    }

    /// <summary>Hip roof / truncated pyramid. topW/topD = 0 gives a pyramid.</summary>
    public void Hip(double cx, double y, double cz, double w, double h, double d, double topW, double topD, int color, double rot = 0)
    {
        SetColor(color);
        double c = Math.Cos(rot), s = Math.Sin(rot);
        (double, double) P(double lx, double lz) => (cx + lx * c - lz * s, cz + lx * s + lz * c);
        double hw = w / 2, hd = d / 2, tw = topW / 2, td = topD / 2, y1 = y + h;
        var b = new[] { P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd) };
        var t = new[] { P(-tw, -td), P(tw, -td), P(tw, td), P(-tw, td) };
        for (int i = 0; i < 4; i++)
        {
            int j = (i + 1) % 4;
            if (topW > 0.01 || topD > 0.01)
                Quad(b[i].Item1, y, b[i].Item2, t[i].Item1, y1, t[i].Item2, t[j].Item1, y1, t[j].Item2, b[j].Item1, y, b[j].Item2);
            else
                Tri(b[i].Item1, y, b[i].Item2, t[0].Item1, y1, t[0].Item2, b[j].Item1, y, b[j].Item2);
        }
        if (topW > 0.01 && topD > 0.01)
            Quad(t[0].Item1, y1, t[0].Item2, t[3].Item1, y1, t[3].Item2, t[2].Item1, y1, t[2].Item2, t[1].Item1, y1, t[1].Item2);
    }

    /// <summary>Cylinder / cone. y is the bottom.</summary>
    public void Cylinder(double cx, double y, double cz, double rBottom, double rTop, double h, int color, int segments = 8, double rot = 0)
    {
        SetColor(color);
        double y1 = y + h;
        for (int i = 0; i < segments; i++)
        {
            double a0 = rot + (double)i / segments * Math.PI * 2;
            double a1 = rot + (double)(i + 1) / segments * Math.PI * 2;
            double bx0 = cx + Math.Cos(a0) * rBottom, bz0 = cz + Math.Sin(a0) * rBottom;
            double bx1 = cx + Math.Cos(a1) * rBottom, bz1 = cz + Math.Sin(a1) * rBottom;
            double tx0 = cx + Math.Cos(a0) * rTop, tz0 = cz + Math.Sin(a0) * rTop;
            double tx1 = cx + Math.Cos(a1) * rTop, tz1 = cz + Math.Sin(a1) * rTop;
            if (rTop > 0.01)
            {
                Quad(bx1, y, bz1, bx0, y, bz0, tx0, y1, tz0, tx1, y1, tz1);
                Tri(cx, y1, cz, tx1, y1, tz1, tx0, y1, tz0);
            }
            else Tri(bx1, y, bz1, bx0, y, bz0, cx, y1, cz);
        }
    }

    /// <summary>Dome (half sphere). y is the bottom.</summary>
    public void Dome(double cx, double y, double cz, double r, int color, int segments = 10, int rings = 4)
    {
        SetColor(color);
        for (int j = 0; j < rings; j++)
        {
            double p0 = (double)j / rings * (Math.PI / 2), p1 = (double)(j + 1) / rings * (Math.PI / 2);
            double r0 = r * Math.Cos(p0), r1 = r * Math.Cos(p1);
            double y0 = y + r * Math.Sin(p0), y1 = y + r * Math.Sin(p1);
            for (int i = 0; i < segments; i++)
            {
                double a0 = (double)i / segments * Math.PI * 2, a1 = (double)(i + 1) / segments * Math.PI * 2;
                double ax = cx + Math.Cos(a0) * r0, az = cz + Math.Sin(a0) * r0;
                double bx = cx + Math.Cos(a1) * r0, bz = cz + Math.Sin(a1) * r0;
                double cxx = cx + Math.Cos(a1) * r1, czz = cz + Math.Sin(a1) * r1;
                double dx = cx + Math.Cos(a0) * r1, dz = cz + Math.Sin(a0) * r1;
                if (j == rings - 1) Tri(bx, y0, bz, ax, y0, az, cx, y1, cz);
                else Quad(bx, y0, bz, ax, y0, az, dx, y1, dz, cxx, y1, czz);
            }
        }
    }

    /// <summary>Ring wall (arc) built from boxes.</summary>
    public void RingWall(double cx, double y, double cz, double radius, double thickness, double h, int color, int segments, double a0 = 0, double a1 = Math.PI * 2)
    {
        double step = (a1 - a0) / segments;
        double segLen = 2 * radius * Math.Sin(step / 2) + 0.2;
        for (int i = 0; i < segments; i++)
        {
            double a = a0 + (i + 0.5) * step;
            Box(cx + Math.Cos(a) * radius, y, cz + Math.Sin(a) * radius, segLen, h, thickness, color, a + Math.PI / 2);
        }
    }

    public void Merge(MeshBuilder o)
    {
        while (_n + o._n > _pos.Length) Grow();
        Array.Copy(o._pos, 0, _pos, _n, o._n);
        Array.Copy(o._nrm, 0, _nrm, _n, o._n);
        Array.Copy(o._col, 0, _col, _n, o._n);
        Array.Copy(o._uv, 0, _uv, _n, o._n);
        Array.Copy(o._uv2, 0, _uv2, _n, o._n);
        _n += o._n;
    }

    /// <summary>The raw arrays for a mesh surface (vertex, normal, colour, uv, uv2 = atlas tile).</summary>
    public Godot.Collections.Array Arrays()
    {
        var arrays = new Godot.Collections.Array();
        arrays.Resize((int)Mesh.ArrayType.Max);
        arrays[(int)Mesh.ArrayType.Vertex] = _pos.AsSpan(0, _n).ToArray();
        arrays[(int)Mesh.ArrayType.Normal] = _nrm.AsSpan(0, _n).ToArray();
        arrays[(int)Mesh.ArrayType.Color] = _col.AsSpan(0, _n).ToArray();
        arrays[(int)Mesh.ArrayType.TexUV] = _uv.AsSpan(0, _n).ToArray();
        arrays[(int)Mesh.ArrayType.TexUV2] = _uv2.AsSpan(0, _n).ToArray();
        return arrays;
    }

    public ArrayMesh ToMesh(Material material = null)
    {
        var mesh = new ArrayMesh();
        if (_n == 0) return mesh;
        mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, Arrays());
        if (material != null) mesh.SurfaceSetMaterial(0, material);
        return mesh;
    }
}
