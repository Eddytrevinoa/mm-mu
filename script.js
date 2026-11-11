import * as THREE from 'three';
import { OBJLoader } from './vendor/OBJLoader.js';

const navigationLinks = document.querySelectorAll('nav a');
const gallery = document.querySelector('.gallery');
const view = document.querySelector('.hand-view');
const message = document.querySelector('.hand-message');
const pages = new Set(['#artist', '#about', '#gallery']);
let resizeView = () => {};
let refreshRenderer = () => {};

function updateNavigation() {
  const currentPage = pages.has(window.location.hash) ? window.location.hash : '#gallery';
  navigationLinks.forEach((link) => {
    if (link.getAttribute('href') === currentPage) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  gallery.hidden = currentPage !== '#gallery';
  if (!gallery.hidden) resizeView();
  refreshRenderer();
}

window.addEventListener('hashchange', updateNavigation);
updateNavigation();

try {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 700 ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 7.8);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.5);
  rim.position.set(4, 1, -3);
  scene.add(rim);

  const tilt = new THREE.Group();
  tilt.rotation.set(-0.55, 0, 0);
  scene.add(tilt);
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI;
  tilt.add(pivot);
  resizeView = () => {
    const width = view.clientWidth;
    const height = view.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 700 ? 1.25 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep the entire hand in view on narrow screens.
    camera.position.z = camera.aspect < 0.8 ? 7.8 * 0.8 / camera.aspect : 7.8;
    camera.updateProjectionMatrix();
    refreshRenderer();
  };
  window.addEventListener('resize', resizeView);
  resizeView();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lastTime;
  let loaded = false;
  let frame = 0;
  function animate(time) {
    frame = 0;
    if (gallery.hidden || document.hidden || !loaded) {
      lastTime = undefined;
      return;
    }
    const delta = lastTime === undefined ? 0 : Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    if (!reducedMotion.matches) pivot.rotation.y += delta * 0.25;
    renderer.render(scene, camera);
    if (!reducedMotion.matches) frame = requestAnimationFrame(animate);
  }
  refreshRenderer = () => {
    if (gallery.hidden || document.hidden || !loaded) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastTime = undefined;
      return;
    }
    if (!frame) frame = requestAnimationFrame(animate);
  };
  document.addEventListener('visibilitychange', refreshRenderer);
  reducedMotion.addEventListener('change', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = undefined;
    refreshRenderer();
  });

  new OBJLoader().load('./assets/hand.obj', (hand) => {
    const bounds = new THREE.Box3().setFromObject(hand);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    hand.position.sub(center);
    hand.scale.setScalar(3.9 / Math.max(size.x, size.y, size.z));
    // Center in scaled coordinates, then rotate around the hand's center.
    hand.position.copy(center).multiplyScalar(-hand.scale.x);
    const material = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.42, metalness: 0.12 });
    hand.traverse((child) => {
      if (child.isMesh) child.material = material;
    });
    pivot.add(hand);
    loaded = true;
    message.remove();
    refreshRenderer();
  }, undefined, () => {
    message.textContent = 'The hand could not be loaded.';
  });
} catch (error) {
  message.textContent = 'The 3D hand is unavailable in this browser.';
}
