import { BufferAttribute, BufferGeometry } from 'three';
import { TILE, type Tile } from './textures';

/**
 * Accumulates flat-shaded, vertex-coloured triangles into a single BufferGeometry.
 * Everything in a chunk (buildings, props, roads) ends up as one draw call.
 */
export class MeshBuilder {
  private pos: number[] = [];
  private nrm: number[] = [];
  private col: number[] = [];
  private uvs: number[] = [];
  private tiles: number[] = [];
  private r = 1;
  private g = 1;
  private b = 1;
  private tile: number = TILE.PLASTER;
  private uvScale = 0.5;
  /** Per-vertex colour override used by gradient faces (bottom darkening). */
  private vcol: number[] | null = null;

  /** Choose the atlas tile and texture density (repeats per metre) for the geometry that follows. */
  material(tile: Tile, repeatsPerMeter = 0.5): void {
    this.tile = tile;
    this.uvScale = repeatsPerMeter;
  }

  get triangleCount(): number {
    return this.pos.length / 9;
  }

  setColor(hex: number): void {
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
  }

  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): void {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    if (this.vcol) this.col.push(...this.vcol);
    else {
      const r = this.r;
      const g = this.g;
      const b = this.b;
      this.col.push(r, g, b, r, g, b, r, g, b);
    }
    // planar UV projection on the dominant axis of the face normal
    const s = this.uvScale;
    const anx = Math.abs(nx);
    const any = Math.abs(ny);
    const anz = Math.abs(nz);
    if (any >= anx && any >= anz) this.uvs.push(ax * s, az * s, bx * s, bz * s, cx * s, cz * s);
    else if (anx >= anz) this.uvs.push(az * s, ay * s, bz * s, by * s, cz * s, cy * s);
    else this.uvs.push(ax * s, ay * s, bx * s, by * s, cx * s, cy * s);
    const t = this.tile;
    this.tiles.push(t, t, t);
  }

  /** Quad whose bottom two vertices are darkened (cheap ambient occlusion at the ground). */
  private shadedSide(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    bottomShade: number,
  ): void {
    const r = this.r;
    const g = this.g;
    const b = this.b;
    const k = bottomShade;
    // vertices: a (bottom), b (top), c (top), d (bottom)
    this.vcol = [r * k, g * k, b * k, r, g, b, r, g, b];
    this.tri(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.vcol = [r * k, g * k, b * k, r, g, b, r * k, g * k, b * k];
    this.tri(ax, ay, az, cx, cy, cz, dx, dy, dz);
    this.vcol = null;
  }

  quad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
  ): void {
    this.tri(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.tri(ax, ay, az, cx, cy, cz, dx, dy, dz);
  }

  /** Axis box, optionally rotated about Y around its own centre. y is the bottom. */
  box(cx: number, y: number, cz: number, w: number, h: number, d: number, color: number, rot = 0, bottomShade = 1): void {
    this.setColor(color);
    const hw = w / 2;
    const hd = d / 2;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const P = (lx: number, lz: number): [number, number] => [cx + lx * c - lz * s, cz + lx * s + lz * c];
    const [x0, z0] = P(-hw, -hd);
    const [x1, z1] = P(hw, -hd);
    const [x2, z2] = P(hw, hd);
    const [x3, z3] = P(-hw, hd);
    const y1 = y + h;
    // top
    this.quad(x0, y1, z0, x3, y1, z3, x2, y1, z2, x1, y1, z1);
    // bottom (skipped for performance: nobody looks under buildings)
    // sides (counter-clockwise seen from outside, so normals point outward)
    if (bottomShade < 1) {
      this.shadedSide(x0, y, z0, x0, y1, z0, x1, y1, z1, x1, y, z1, bottomShade);
      this.shadedSide(x1, y, z1, x1, y1, z1, x2, y1, z2, x2, y, z2, bottomShade);
      this.shadedSide(x2, y, z2, x2, y1, z2, x3, y1, z3, x3, y, z3, bottomShade);
      this.shadedSide(x3, y, z3, x3, y1, z3, x0, y1, z0, x0, y, z0, bottomShade);
    } else {
      this.quad(x0, y, z0, x0, y1, z0, x1, y1, z1, x1, y, z1);
      this.quad(x1, y, z1, x1, y1, z1, x2, y1, z2, x2, y, z2);
      this.quad(x2, y, z2, x2, y1, z2, x3, y1, z3, x3, y, z3);
      this.quad(x3, y, z3, x3, y1, z3, x0, y1, z0, x0, y, z0);
    }
  }

  /** Vertical rectangle centred at (cx, y+h/2, cz), width w, facing the horizontal direction (nx, nz). */
  wallQuad(cx: number, y: number, cz: number, w: number, h: number, nx: number, nz: number, color: number): void {
    this.setColor(color);
    const len = Math.hypot(nx, nz) || 1;
    const tx = (-nz / len) * (w / 2);
    const tz = (nx / len) * (w / 2);
    // bottom-left, top-left, top-right, bottom-right: counter-clockwise seen from the (nx, nz) side
    this.quad(cx - tx, y, cz - tz, cx - tx, y + h, cz - tz, cx + tx, y + h, cz + tz, cx + tx, y, cz + tz);
  }

  /** Arched opening: a rectangle with a semicircular top, facing (nx, nz). */
  archQuad(cx: number, y: number, cz: number, w: number, h: number, nx: number, nz: number, color: number): void {
    const r = w / 2;
    const rectH = Math.max(0.1, h - r);
    this.wallQuad(cx, y, cz, w, rectH, nx, nz, color);
    this.setColor(color);
    const len = Math.hypot(nx, nz) || 1;
    const tx = -nz / len;
    const tz = nx / len;
    const yc = y + rectH;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI;
      const a1 = ((i + 1) / n) * Math.PI;
      const p0x = cx + tx * Math.cos(a0) * r;
      const p0z = cz + tz * Math.cos(a0) * r;
      const p0y = yc + Math.sin(a0) * r;
      const p1x = cx + tx * Math.cos(a1) * r;
      const p1z = cz + tz * Math.cos(a1) * r;
      const p1y = yc + Math.sin(a1) * r;
      // fan from centre; winding so the normal points along (nx, nz)
      this.tri(cx, yc, cz, p0x, p0y, p0z, p1x, p1y, p1z);
    }
  }

  /** Double-sided quad from four explicit corners (for awnings and sloped panels). */
  panel(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number, color: number): void {
    this.setColor(color);
    this.quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
    this.quad(dx, dy, dz, cx, cy, cz, bx, by, bz, ax, ay, az);
  }

  /** Flat quad on the ground (y up), with slight y offset. */
  groundQuad(x0: number, z0: number, x1: number, z1: number, x2: number, z2: number, x3: number, z3: number, y: number, color: number): void {
    this.setColor(color);
    this.quad(x0, y, z0, x3, y, z3, x2, y, z2, x1, y, z1);
  }

  /** Gable roof: triangular prism, ridge along local x. */
  prism(cx: number, y: number, cz: number, w: number, h: number, d: number, color: number, rot = 0): void {
    this.setColor(color);
    const hw = w / 2;
    const hd = d / 2;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const P = (lx: number, lz: number): [number, number] => [cx + lx * c - lz * s, cz + lx * s + lz * c];
    const [x0, z0] = P(-hw, -hd);
    const [x1, z1] = P(hw, -hd);
    const [x2, z2] = P(hw, hd);
    const [x3, z3] = P(-hw, hd);
    const [rx0, rz0] = P(-hw, 0);
    const [rx1, rz1] = P(hw, 0);
    const y1 = y + h;
    // two slopes
    this.quad(x0, y, z0, rx0, y1, rz0, rx1, y1, rz1, x1, y, z1);
    this.quad(x2, y, z2, rx1, y1, rz1, rx0, y1, rz0, x3, y, z3);
    // gable ends
    this.tri(x1, y, z1, rx1, y1, rz1, x2, y, z2);
    this.tri(x3, y, z3, rx0, y1, rz0, x0, y, z0);
  }

  /** Hip roof / truncated pyramid. topW/topD = 0 gives a pyramid. */
  hip(cx: number, y: number, cz: number, w: number, h: number, d: number, topW: number, topD: number, color: number, rot = 0): void {
    this.setColor(color);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const P = (lx: number, lz: number): [number, number] => [cx + lx * c - lz * s, cz + lx * s + lz * c];
    const hw = w / 2;
    const hd = d / 2;
    const tw = topW / 2;
    const td = topD / 2;
    const y1 = y + h;
    const b = [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)];
    const t = [P(-tw, -td), P(tw, -td), P(tw, td), P(-tw, td)];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      if (topW > 0.01 || topD > 0.01) {
        this.quad(b[i][0], y, b[i][1], t[i][0], y1, t[i][1], t[j][0], y1, t[j][1], b[j][0], y, b[j][1]);
      } else {
        this.tri(b[i][0], y, b[i][1], t[0][0], y1, t[0][1], b[j][0], y, b[j][1]);
      }
    }
    if (topW > 0.01 && topD > 0.01) {
      this.quad(t[0][0], y1, t[0][1], t[3][0], y1, t[3][1], t[2][0], y1, t[2][1], t[1][0], y1, t[1][1]);
    }
  }

  /** Cylinder / cone with flat shading. y is bottom. */
  cylinder(cx: number, y: number, cz: number, rBottom: number, rTop: number, h: number, color: number, segments = 8, rot = 0): void {
    this.setColor(color);
    const y1 = y + h;
    for (let i = 0; i < segments; i++) {
      const a0 = rot + (i / segments) * Math.PI * 2;
      const a1 = rot + ((i + 1) / segments) * Math.PI * 2;
      const bx0 = cx + Math.cos(a0) * rBottom;
      const bz0 = cz + Math.sin(a0) * rBottom;
      const bx1 = cx + Math.cos(a1) * rBottom;
      const bz1 = cz + Math.sin(a1) * rBottom;
      const tx0 = cx + Math.cos(a0) * rTop;
      const tz0 = cz + Math.sin(a0) * rTop;
      const tx1 = cx + Math.cos(a1) * rTop;
      const tz1 = cz + Math.sin(a1) * rTop;
      if (rTop > 0.01) {
        this.quad(bx1, y, bz1, bx0, y, bz0, tx0, y1, tz0, tx1, y1, tz1);
        this.tri(cx, y1, cz, tx1, y1, tz1, tx0, y1, tz0);
      } else {
        this.tri(bx1, y, bz1, bx0, y, bz0, cx, y1, cz);
      }
    }
  }

  /** Dome (half sphere), y is bottom. */
  dome(cx: number, y: number, cz: number, r: number, color: number, segments = 10, rings = 4): void {
    this.setColor(color);
    for (let j = 0; j < rings; j++) {
      const p0 = (j / rings) * (Math.PI / 2);
      const p1 = ((j + 1) / rings) * (Math.PI / 2);
      const r0 = r * Math.cos(p0);
      const r1 = r * Math.cos(p1);
      const y0 = y + r * Math.sin(p0);
      const y1 = y + r * Math.sin(p1);
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        const ax = cx + Math.cos(a0) * r0;
        const az = cz + Math.sin(a0) * r0;
        const bx = cx + Math.cos(a1) * r0;
        const bz = cz + Math.sin(a1) * r0;
        const cxx = cx + Math.cos(a1) * r1;
        const czz = cz + Math.sin(a1) * r1;
        const dx = cx + Math.cos(a0) * r1;
        const dz = cz + Math.sin(a0) * r1;
        if (j === rings - 1) this.tri(bx, y0, bz, ax, y0, az, cx, y1, cz);
        else this.quad(bx, y0, bz, ax, y0, az, dx, y1, dz, cxx, y1, czz);
      }
    }
  }

  /** Ring wall segment (arc) built from boxes. */
  ringWall(cx: number, y: number, cz: number, radius: number, thickness: number, h: number, color: number, segments: number, a0 = 0, a1 = Math.PI * 2): void {
    const step = (a1 - a0) / segments;
    const segLen = 2 * radius * Math.sin(step / 2) + 0.2;
    for (let i = 0; i < segments; i++) {
      const a = a0 + (i + 0.5) * step;
      this.box(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius, segLen, h, thickness, color, a + Math.PI / 2);
    }
  }

  merge(other: MeshBuilder): void {
    for (let i = 0; i < other.pos.length; i++) this.pos.push(other.pos[i]);
    for (let i = 0; i < other.nrm.length; i++) this.nrm.push(other.nrm[i]);
    for (let i = 0; i < other.col.length; i++) this.col.push(other.col[i]);
    for (let i = 0; i < other.uvs.length; i++) this.uvs.push(other.uvs[i]);
    for (let i = 0; i < other.tiles.length; i++) this.tiles.push(other.tiles[i]);
  }

  isEmpty(): boolean {
    return this.pos.length === 0;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    g.setAttribute('tile', new BufferAttribute(new Float32Array(this.tiles), 1));
    g.computeBoundingSphere();
    return g;
  }
}
