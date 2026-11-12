import * as THREE from 'three';
import { OBJLoader } from './vendor/OBJLoader.js';

const section = document.querySelector('.about-page');
const view = document.querySelector('.about-sculpture');
const message = document.querySelector('.about-sculpture-message');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window) {
  const paragraphObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: .08 });
  section.querySelectorAll('.page-copy p').forEach((paragraph) => {
    paragraph.classList.add('reveal-pending');
    paragraphObserver.observe(paragraph);
  });
}
let renderer, scene, camera, sculpture, handPose;
let started = false;
let loaded = false;
let inView = true;
let frame = 0;
let previousTime;
let lastInteraction = 0;
let pointer = null;

function visible() {
  return !section.hidden && !document.hidden && inView;
}

function refresh() {
  if (!visible() || !loaded) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = undefined;
    return;
  }
  if (!frame) frame = requestAnimationFrame(draw);
}

function draw(time) {
  frame = 0;
  if (!visible() || !loaded) { previousTime = undefined; return; }
  const delta = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, .1);
  previousTime = time;
  if (!reducedMotion.matches && !pointer && time - lastInteraction > 3000) sculpture.rotation.y += delta * .12;
  renderer.render(scene, camera);
  if (!renderer.domElement.classList.contains('is-ready')) {
    requestAnimationFrame(() => renderer.domElement.classList.add('is-ready'));
  }
  if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
}

function resize() {
  if (!renderer || !view.clientWidth || !view.clientHeight) return;
  const width = view.clientWidth;
  const height = view.clientHeight;
  const aspect = width / height;
  const halfHeight = Math.max(1.85, 2.9 / aspect);
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.25 : 2));
  renderer.setSize(width, height, false);
  refresh();
}

function model(url, material, angle, x, y, z, tilt) {
  return new Promise((resolve, reject) => {
    new OBJLoader().load(url, (hand) => {
      const bounds = new THREE.Box3().setFromObject(hand);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 3.1 / Math.max(size.x, size.y, size.z);
      hand.scale.setScalar(scale);
      hand.position.copy(center).multiplyScalar(-scale);
      hand.traverse((child) => { if (child.isMesh) child.material = material; });
      const mount = new THREE.Group();
      mount.position.set(x, y, z);
      mount.rotation.set(tilt, 0, angle);
      mount.add(hand);
      resolve(mount);
    }, undefined, reject);
  });
}

async function initialize() {
  if (started) return;
  started = true;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.domElement.classList.add('sculpture-canvas');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    view.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 100);
    camera.position.set(0, 8, 12);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-3, 6, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 1.6);
    rim.position.set(4, 2, -4);
    scene.add(rim);
    sculpture = new THREE.Group();
    handPose = new THREE.Group();
    handPose.rotation.x = -Math.PI / 2;
    sculpture.add(handPose);
    scene.add(sculpture);
    resize();
    const material = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: .34, metalness: .12 });
    const [right, left] = await Promise.all([
      model('./assets/hand.obj', material, 2.15, -.35, .24, .3, -.25),
      model('./assets/left-hand.obj', material, -2.15, .38, -.22, -.35, .2)
    ]);
    handPose.add(left, right);
    loaded = true;
    lastInteraction = performance.now();
    message.remove();
    resize();
    refresh();
  } catch (error) {
    message.textContent = 'No se pudieron cargar las manos en 3D.';
    if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
  }
}

new MutationObserver(() => {
  if (!section.hidden) { initialize(); resize(); }
  refresh();
}).observe(section, { attributes: true, attributeFilter: ['hidden'] });
new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; refresh(); }).observe(view);
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', refresh);
reducedMotion.addEventListener('change', () => { if (frame) cancelAnimationFrame(frame); frame = 0; previousTime = undefined; refresh(); });

view.addEventListener('pointerdown', (event) => {
  if (!loaded || event.button !== 0) return;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, axis: null };
  lastInteraction = performance.now();
});
view.addEventListener('pointermove', (event) => {
  if (!pointer || pointer.id !== event.pointerId) return;
  if (!pointer.axis) {
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (Math.hypot(dx, dy) < 6) return;
    pointer.axis = event.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'rotate';
    if (pointer.axis === 'rotate') view.setPointerCapture(event.pointerId);
  }
  if (pointer.axis !== 'rotate') return;
  sculpture.rotation.y += (event.clientX - pointer.x) * .01;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  lastInteraction = performance.now();
  refresh();
});
function endPointer(event) {
  if (!pointer || pointer.id !== event.pointerId) return;
  pointer = null;
  lastInteraction = performance.now();
  refresh();
}
view.addEventListener('pointerup', endPointer);
view.addEventListener('pointercancel', endPointer);
view.addEventListener('keydown', (event) => {
  if (!loaded || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'ArrowLeft') sculpture.rotation.y -= .18;
  if (event.key === 'ArrowRight') sculpture.rotation.y += .18;
  lastInteraction = performance.now();
  refresh();
});
if (!section.hidden) initialize();
