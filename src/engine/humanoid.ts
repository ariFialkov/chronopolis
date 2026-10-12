import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial, SphereGeometry } from 'three';
import type { HatKind } from '../eras/types';

const geoBox = new BoxGeometry(1, 1, 1);
const geoCyl = new CylinderGeometry(0.5, 0.5, 1, 8);
const geoCone = new ConeGeometry(0.5, 1, 8);
const geoSphere = new SphereGeometry(0.5, 8, 6);
const matCache = new Map<number, MeshLambertMaterial>();
function mat(c: number): MeshLambertMaterial {
  let m = matCache.get(c);
  if (!m) {
    m = new MeshLambertMaterial({ color: c });
    matCache.set(c, m);
  }
  return m;
}

export interface Look {
  body: number;
  legs: number;
  skin: number;
  hat: HatKind;
  hatColor: number;
  hair?: number;
}

/** A low-poly person. Shared between the player and NPCs. */
export class Humanoid {
  readonly group = new Group();
  private legL: Mesh;
  private legR: Mesh;
  private armL: Mesh;
  private armR: Mesh;
  private torso: Mesh;
  private phase = 0;

  constructor(look: Look) {
    const g = this.group;
    this.torso = new Mesh(geoBox, mat(look.body));
    this.torso.scale.set(0.62, 0.78, 0.36);
    this.torso.position.y = 1.15;
    g.add(this.torso);
    const head = new Mesh(geoBox, mat(look.skin));
    head.scale.set(0.34, 0.36, 0.34);
    head.position.y = 1.78;
    g.add(head);
    const hair = new Mesh(geoBox, mat(look.hair ?? 0x2a1a10));
    hair.scale.set(0.36, 0.12, 0.36);
    hair.position.y = 1.94;
    g.add(hair);
    this.legL = this.limb(look.legs, -0.16, 0.76, 0.22, 0.76, 0.24);
    this.legR = this.limb(look.legs, 0.16, 0.76, 0.22, 0.76, 0.24);
    this.armL = this.limb(look.body, -0.4, 1.5, 0.16, 0.68, 0.18);
    this.armR = this.limb(look.body, 0.4, 1.5, 0.16, 0.68, 0.18);
    this.addHat(look.hat, look.hatColor);
    this.enableShadows();
  }

  private limb(color: number, x: number, y: number, w: number, h: number, d: number): Mesh {
    // pivot at the top of the limb
    const pivot = new Mesh(geoBox, mat(color));
    pivot.scale.set(w, h, d);
    pivot.position.set(x, y - h / 2, 0);
    const holder = new Group();
    holder.position.set(x, y, 0);
    pivot.position.set(0, -h / 2, 0);
    holder.add(pivot);
    this.group.add(holder);
    return pivot;
  }

  private addHat(kind: HatKind, color: number): void {
    const g = this.group;
    const y = 1.96;
    let m: Mesh | null = null;
    switch (kind) {
      case 'none':
        return;
      case 'helmet':
        m = new Mesh(geoSphere, mat(color));
        m.scale.set(0.42, 0.34, 0.42);
        m.position.y = y - 0.08;
        break;
      case 'kabuto':
        m = new Mesh(geoSphere, mat(color));
        m.scale.set(0.46, 0.3, 0.46);
        m.position.y = y - 0.04;
        break;
      case 'plume': {
        m = new Mesh(geoSphere, mat(0xb8a24a));
        m.scale.set(0.42, 0.34, 0.42);
        m.position.y = y - 0.08;
        const plume = new Mesh(geoBox, mat(color));
        plume.scale.set(0.08, 0.2, 0.4);
        plume.position.set(0, y + 0.16, 0);
        g.add(plume);
        break;
      }
      case 'cap':
        m = new Mesh(geoCyl, mat(color));
        m.scale.set(0.4, 0.12, 0.4);
        m.position.y = y;
        break;
      case 'bowler':
      case 'fedora':
      case 'tophat': {
        const brim = new Mesh(geoCyl, mat(color));
        brim.scale.set(kind === 'tophat' ? 0.5 : 0.56, 0.04, kind === 'tophat' ? 0.5 : 0.56);
        brim.position.y = y - 0.02;
        g.add(brim);
        m = new Mesh(geoCyl, mat(color));
        const h = kind === 'tophat' ? 0.4 : kind === 'bowler' ? 0.18 : 0.2;
        m.scale.set(0.34, h, 0.34);
        m.position.y = y + h / 2;
        break;
      }
      case 'cowboy': {
        const brim = new Mesh(geoCyl, mat(color));
        brim.scale.set(0.72, 0.04, 0.6);
        brim.position.y = y - 0.02;
        g.add(brim);
        m = new Mesh(geoBox, mat(color));
        m.scale.set(0.34, 0.24, 0.34);
        m.position.y = y + 0.1;
        break;
      }
      case 'tricorn':
        m = new Mesh(geoCone, mat(color));
        m.scale.set(0.62, 0.2, 0.62);
        m.position.y = y + 0.06;
        break;
      case 'hood':
        m = new Mesh(geoCone, mat(color));
        m.scale.set(0.5, 0.46, 0.5);
        m.position.y = y + 0.08;
        break;
      case 'crown':
        m = new Mesh(geoCyl, mat(color));
        m.scale.set(0.36, 0.14, 0.36);
        m.position.y = y + 0.04;
        break;
      case 'headdress': {
        m = new Mesh(geoCone, mat(color));
        m.scale.set(0.5, 0.5, 0.2);
        m.position.y = y + 0.2;
        break;
      }
      case 'feather': {
        m = new Mesh(geoBox, mat(color));
        m.scale.set(0.08, 0.45, 0.08);
        m.position.set(0.12, y + 0.2, 0);
        m.rotation.z = -0.3;
        break;
      }
      case 'conical':
        m = new Mesh(geoCone, mat(color));
        m.scale.set(0.8, 0.26, 0.8);
        m.position.y = y + 0.1;
        break;
      case 'turban':
        m = new Mesh(geoSphere, mat(color));
        m.scale.set(0.42, 0.3, 0.42);
        m.position.y = y - 0.02;
        break;
      case 'nemes': {
        m = new Mesh(geoBox, mat(color));
        m.scale.set(0.4, 0.42, 0.42);
        m.position.set(0, y - 0.12, -0.04);
        break;
      }
    }
    if (m) g.add(m);
  }

  /** speed in m/s drives the walk cycle. */
  enableShadows(): void {
    this.group.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
    });
  }

  animate(dt: number, speed: number): void {
    this.phase += dt * Math.min(14, speed * 2.4);
    const amp = Math.min(0.9, speed * 0.16);
    const s = Math.sin(this.phase) * amp;
    this.legL.parent!.rotation.x = s;
    this.legR.parent!.rotation.x = -s;
    this.armL.parent!.rotation.x = -s * 0.8;
    this.armR.parent!.rotation.x = s * 0.8;
    this.torso.position.y = 1.15 + Math.abs(Math.sin(this.phase * 2)) * amp * 0.03;
  }
}
