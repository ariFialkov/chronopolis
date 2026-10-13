import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Vector3 } from 'three';

/**
 * Builds flat-shaded, vertex-coloured geometry where every primitive is rigidly bound to one bone.
 * Coordinates are in the character's bind pose: feet at y = 0, facing +z.
 */
export class Mesher {
  private pos: number[] = [];
  private nrm: number[] = [];
  private col: number[] = [];
  private si: number[] = [];
  private sw: number[] = [];
  private bone = 0;
  private c = new Color();
  private xf: Matrix4 | null = null;
  /** emit both windings (open surfaces such as coat tails and capes) */
  doubleSided = false;
  private va = new Vector3();
  private vb = new Vector3();
  private vc = new Vector3();

  setBone(b: number): this {
    this.bone = b;
    return this;
  }

  color(hex: number): this {
    this.c.setHex(hex);
    return this;
  }

  /** Run `fn` with every emitted point transformed by `m` (applied after the primitive's own placement). */
  transform(m: Matrix4, fn: () => void): void {
    const prev = this.xf;
    this.xf = prev ? prev.clone().multiply(m) : m;
    fn();
    this.xf = prev;
  }

  /** Rotate about a pivot (Euler XYZ) while building `fn`. */
  rotated(px: number, py: number, pz: number, rx: number, ry: number, rz: number, fn: () => void): void {
    const m = new Matrix4()
      .makeTranslation(px, py, pz)
      .multiply(new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz)))
      .multiply(new Matrix4().makeTranslation(-px, -py, -pz));
    this.transform(m, fn);
  }

  tri(a: number[], b: number[], c: number[]): void {
    this.emit(a, b, c);
    if (this.doubleSided) this.emit(a, c, b);
  }

  private emit(a: number[], b: number[], c: number[]): void {
    const A = this.va.set(a[0], a[1], a[2]);
    const B = this.vb.set(b[0], b[1], b[2]);
    const C = this.vc.set(c[0], c[1], c[2]);
    if (this.xf) {
      A.applyMatrix4(this.xf);
      B.applyMatrix4(this.xf);
      C.applyMatrix4(this.xf);
    }
    const ux = B.x - A.x;
    const uy = B.y - A.y;
    const uz = B.z - A.z;
    const wx = C.x - A.x;
    const wy = C.y - A.y;
    const wz = C.z - A.z;
    let nx = uy * wz - uz * wy;
    let ny = uz * wx - ux * wz;
    let nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const p of [A, B, C]) {
      this.pos.push(p.x, p.y, p.z);
      this.nrm.push(nx, ny, nz);
      this.col.push(this.c.r, this.c.g, this.c.b);
      this.si.push(this.bone, 0, 0, 0);
      this.sw.push(1, 0, 0, 0);
    }
  }

  quad(a: number[], b: number[], c: number[], d: number[]): void {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  /**
   * Box from y0 to y1 centred on (cx, cz). The top face can be scaled (taper) and shifted in z
   * (lean), which makes torsos, limbs and hat crowns.
   */
  box(cx: number, y0: number, y1: number, cz: number, w: number, d: number, opt: { topW?: number; topD?: number; leanZ?: number; caps?: boolean } = {}): void {
    const hw = w / 2;
    const hd = d / 2;
    const tw = (opt.topW ?? w) / 2;
    const td = (opt.topD ?? d) / 2;
    const lz = opt.leanZ ?? 0;
    const b0 = [cx - hw, y0, cz - hd];
    const b1 = [cx + hw, y0, cz - hd];
    const b2 = [cx + hw, y0, cz + hd];
    const b3 = [cx - hw, y0, cz + hd];
    const t0 = [cx - tw, y1, cz - td + lz];
    const t1 = [cx + tw, y1, cz - td + lz];
    const t2 = [cx + tw, y1, cz + td + lz];
    const t3 = [cx - tw, y1, cz + td + lz];
    if (opt.caps !== false) {
      this.quad(t0, t3, t2, t1);
      this.quad(b0, b1, b2, b3);
    }
    this.quad(b3, b2, t2, t3);
    this.quad(b1, b0, t0, t1);
    this.quad(b2, b1, t1, t2);
    this.quad(b0, b3, t3, t0);
  }

  /** Centred box (for small details). */
  cube(cx: number, cy: number, cz: number, w: number, h: number, d: number): void {
    this.box(cx, cy - h / 2, cy + h / 2, cz, w, d);
  }

  /**
   * Elliptical frustum around the vertical axis. `skip(i)` leaves segments out (open coat fronts);
   * `colorOf(i)` paints segments individually (stripes, strips).
   */
  frustum(
    cx: number, y0: number, y1: number, cz: number,
    rx0: number, rz0: number, rx1: number, rz1: number,
    seg = 8,
    opt: { top?: boolean; bottom?: boolean; skip?: (i: number) => boolean; colorOf?: (i: number) => number; phase?: number } = {},
  ): void {
    const ph = opt.phase ?? 0;
    const P = (i: number, y: number, rx: number, rz: number): number[] => {
      const a = ph + (i / seg) * Math.PI * 2;
      return [cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz];
    };
    const base = this.c.getHex();
    for (let i = 0; i < seg; i++) {
      if (opt.skip?.(i)) continue;
      if (opt.colorOf) this.c.setHex(opt.colorOf(i));
      const b0 = P(i, y0, rx0, rz0);
      const b1 = P(i + 1, y0, rx0, rz0);
      const t0 = P(i, y1, rx1, rz1);
      const t1 = P(i + 1, y1, rx1, rz1);
      this.quad(b0, t0, t1, b1);
      if (opt.top !== false && rx1 > 0) this.tri([cx, y1, cz], t1, t0);
      if (opt.bottom !== false && rx0 > 0) this.tri([cx, y0, cz], b0, b1);
    }
    this.c.setHex(base);
  }

  /** Ellipsoid (or the upper part of one: lat0 = 0 gives a dome). */
  sphere(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, seg = 8, rings = 5, lat0 = -Math.PI / 2, lat1 = Math.PI / 2): void {
    const P = (i: number, j: number): number[] => {
      const lat = lat0 + ((lat1 - lat0) * j) / rings;
      const a = (i / seg) * Math.PI * 2;
      return [cx + Math.cos(a) * Math.cos(lat) * rx, cy + Math.sin(lat) * ry, cz + Math.sin(a) * Math.cos(lat) * rz];
    };
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) this.quad(P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j));
    }
  }

  get triangles(): number {
    return this.pos.length / 9;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(this.si), 4));
    g.setAttribute('skinWeight', new BufferAttribute(new Float32Array(this.sw), 4));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
