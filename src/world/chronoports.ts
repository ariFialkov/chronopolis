import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, Scene, TorusGeometry } from 'three';
import type { Era } from '../eras/types';
import { CHRONOPORT_ERAS } from '../eras';
import type { World } from './world';

export interface PortObject {
  era: Era;
  group: Group;
  disc: Mesh;
  ring: Mesh;
}

export const PORT_NOTICE_RADIUS = 20;
export const PORT_USE_RADIUS = 3.2;

/** The chronoports: ancient rings that exist in every era at the same spot. */
export class ChronoportManager {
  private scene: Scene;
  readonly ports: PortObject[] = [];
  private time = 0;

  constructor(scene: Scene, world: World) {
    this.scene = scene;
    for (const era of CHRONOPORT_ERAS) {
      const p = era.chronoport!;
      const group = new Group();
      const stone = new MeshLambertMaterial({ color: 0x6a6460 });
      const base = new Mesh(new CylinderGeometry(3.2, 3.6, 0.5, 12), stone);
      base.position.y = 0.25;
      group.add(base);
      const ring = new Mesh(new TorusGeometry(2.1, 0.32, 8, 24), new MeshLambertMaterial({ color: 0x8a8078 }));
      ring.position.y = 2.7;
      group.add(ring);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const pillar = new Mesh(new CylinderGeometry(0.28, 0.34, 3.4, 6), stone);
        pillar.position.set(Math.cos(a) * 3.0, 2.2, Math.sin(a) * 3.0);
        group.add(pillar);
      }
      const disc = new Mesh(new CylinderGeometry(1.8, 1.8, 0.05, 24), new MeshBasicMaterial({ color: 0x6ad0ff, transparent: true, opacity: 0.55 }));
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 2.7;
      group.add(disc);
      const y = world.groundY(p.x, p.z);
      group.position.set(p.x, y, p.z);
      scene.add(group);
      this.ports.push({ era, group, disc, ring });
    }
  }

  refreshHeights(world: World): void {
    for (const p of this.ports) p.group.position.y = world.groundY(p.era.chronoport!.x, p.era.chronoport!.z);
  }

  /** Whether a port is live in the given era: home era, or the port's own era. */
  isActive(port: PortObject, currentEra: Era, homeEraId: string): boolean {
    return currentEra.id === homeEraId || currentEra.id === port.era.id;
  }

  update(dt: number, currentEra: Era, homeEraId: string): void {
    this.time += dt;
    for (const p of this.ports) {
      const active = this.isActive(p, currentEra, homeEraId);
      const m = p.disc.material as MeshBasicMaterial;
      m.opacity = active ? 0.45 + 0.2 * Math.sin(this.time * 2.5) : 0.08;
      m.color.set(active ? 0x6ad0ff : 0x445566);
      p.disc.rotation.z += dt * (active ? 0.8 : 0.05);
      p.ring.rotation.y += dt * 0.2;
    }
  }

  nearest(px: number, pz: number, radius: number): PortObject | null {
    let best: PortObject | null = null;
    let bd = radius;
    for (const p of this.ports) {
      const d = Math.hypot(p.era.chronoport!.x - px, p.era.chronoport!.z - pz);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  dispose(): void {
    for (const p of this.ports) this.scene.remove(p.group);
  }
}
