/**
 * Developer page (served by `npm run dev` at /lineup.html, not part of the game build): shows an
 * era's player outfit and its five townspeople side by side, like the character sheet.
 * Query: ?era=roman&yaw=0.6&walk=1&variant=1
 */
import { AmbientLight, Color, DirectionalLight, HemisphereLight, Mesh, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer } from 'three';
import { Character } from '../characters/character';
import { CAST, varyOutfit } from '../characters/cast';
import { ERAS } from '../eras';

const q = new URLSearchParams(location.search);
const eraId = q.get('era') ?? 'industrial';
const yaw = Number(q.get('yaw') ?? 0);
const walk = q.get('walk') === '1';
const variant = Number(q.get('variant') ?? 0);
const era = ERAS.find((e) => e.id === eraId)!;
const cast = CAST[eraId];

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);
const scene = new Scene();
scene.background = new Color(era.sky);
scene.add(new HemisphereLight(0xffffff, 0x887766, 1.2), new AmbientLight(0xffffff, 0.2));
const sun = new DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 8, 6);
sun.castShadow = true;
scene.add(sun);
const ground = new Mesh(new PlaneGeometry(40, 40), new MeshLambertMaterial({ color: 0x8a8070 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const people: [string, Character][] = [['Player', new Character(cast.player)]];
const npcByOutfit = new Map(era.npcs.map((n) => [n.outfit, n.role]));
for (const [key, outfit] of Object.entries(cast.roles)) {
  if (!npcByOutfit.has(key)) continue;
  people.push([`${key} (${npcByOutfit.get(key)})`, new Character(varyOutfit(outfit, variant))]);
}
const gap = 1.15;
people.forEach(([, c], i) => {
  c.group.position.set((i - (people.length - 1) / 2) * gap, 0, 0);
  c.group.rotation.y = yaw;
  scene.add(c.group);
});
const camera = new PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
const zoom = q.get('zoom') === '1';
camera.position.set(0, zoom ? 1.65 : 1.15, zoom ? 3.4 : 6.6);
camera.lookAt(0, zoom ? 1.55 : 1.0, 0);
document.getElementById('title')!.textContent = `${era.name} (${era.yearLabel})`;
camera.updateMatrixWorld();
document.getElementById('labels')!.innerHTML = people
  .map(([n, c]) => {
    const p = c.group.position.clone().project(camera);
    return `<span style="position:absolute;left:${((p.x + 1) / 2) * 100}%;transform:translateX(-50%)">${n}</span>`;
  })
  .join('');
document.getElementById('nav')!.innerHTML = ERAS.map((e) => `<a href="?era=${e.id}">${e.id}</a>`).join('');
let last = performance.now();
function frame(t: number): void {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  for (const [, c] of people) c.animate(dt, walk ? 1.4 : 0);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as unknown as { ready: boolean }).ready = true;
