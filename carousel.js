const files = [
  ...Array.from({ length: 7 }, (_, i) => `MMMU_Grain_0${i + 1}.jpg`),
  ...Array.from({ length: 4 }, (_, i) => `microscopy-0${i + 1}.png`),
  '01.jpg', '02_Corrected.jpg', '03.jpg', '04_Corrected.jpg', '05_Corrected.jpg',
  '07_Corrected.jpg', '08.jpg', '09_Corrected.jpg', '010.jpg', '011.jpg'
];
const carousel = document.querySelector('.carousel');
const frontTrack = document.querySelector('.carousel-track--front');
const status = document.querySelector('.carousel-status');
const dialog = document.querySelector('.image-dialog');
const enlarged = document.querySelector('.image-dialog-image');
const closeButton = document.querySelector('.image-dialog-close');
const dialogStatus = document.querySelector('.image-dialog-status');
const dialogArrows = [...document.querySelectorAll('.image-dialog-arrow')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let position = 0;
let targetPosition = 0;
let rotationFrame = 0;
let finishRotation = null;
let selectedCard = null;
let pointer = null;
let suppressClick = false;
let closing = false;
let centering = false;
let switching = false;
let imageRequest = 0;
let viewerSwipe = null;
let suppressViewerClick = false;

const cards = files.map((file, index) => {
  const button = document.createElement('button');
  const image = document.createElement('img');
  button.type = 'button';
  button.className = 'carousel-card';
  const label = index < 7 ? `visual composition ${index + 1}` : index < 11 ? `microscopy image ${index - 6}` : `documentation image ${index - 10}`;
  button.setAttribute('aria-label', `Open ${label}`);
  image.src = `./assets/gallery/thumbs/${file}`;
  image.alt = '';
  image.decoding = 'async';
  image.draggable = false;
  button.appendChild(image);
  button.addEventListener('click', () => {
    if (!suppressClick) selectImage(index);
  });
  frontTrack.appendChild(button);
  return button;
});

function render() {
  const width = carousel.clientWidth;
  const height = carousel.clientHeight;
  if (!width || !height) return;
  const mobile = width < 700;
  const radiusX = Math.min(width * (mobile ? .78 : .40), mobile ? 620 : 750);
  const radiusY = height * (mobile ? .15 : .28);
  cards.forEach((card, index) => {
    const baseAngle = (index - position) * Math.PI * 2 / files.length;
    // Spread the front of the ring while drawing the back images closer together.
    const angle = mobile ? baseAngle + .4 * Math.sin(baseAngle) : baseAngle;
    const depth = Math.cos(angle);
    const x = Math.sin(angle) * radiusX;
    const y = -radiusY * (1 - depth);
    const frontEmphasis = Math.max(0, (depth - .75) / .25);
    const scale = (mobile
      ? .68 + .32 * depth + .30 * frontEmphasis
      : .76 + .24 * depth + .16 * frontEmphasis) + (mobile ? .45 : .3) * frontEmphasis ** 8;
    card.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotateY(${-Math.sin(angle) * 18}deg) scale(${scale})`;
    card.style.opacity = "1";
    card.style.zIndex = depth >= 0 ? String(3 + Math.round(depth * 50)) : '1';
    card.style.pointerEvents = "auto";
    card.tabIndex = 0;
    card.removeAttribute("aria-hidden");
  });
}

function cancelRotation() {
  if (rotationFrame) cancelAnimationFrame(rotationFrame);
  rotationFrame = 0;
  if (finishRotation) finishRotation();
  finishRotation = null;
}

function rotateTo(target) {
  cancelRotation();
  const start = position;
  const distance = ((target - start + files.length * 1.5) % files.length) - files.length / 2;
  targetPosition = ((target % files.length) + files.length) % files.length;
  if (reducedMotion.matches || Math.abs(distance) < .001) {
    position = targetPosition;
    render();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    finishRotation = resolve;
    const started = performance.now();
    const duration = Math.min(1100, 700 + Math.abs(distance) * 45);
    function step(now) {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      position = start + distance * eased;
      render();
      if (progress < 1) {
        rotationFrame = requestAnimationFrame(step);
      } else {
        position = targetPosition;
        rotationFrame = 0;
        finishRotation = null;
        render();
        resolve();
      }
    }
    rotationFrame = requestAnimationFrame(step);
  });
}

function move(delta) {
  if (centering) return;
  const target = (Math.round(targetPosition) + delta + files.length) % files.length;
  rotateTo(target);
  status.textContent = `Image ${target + 1} of ${files.length}`;
}

document.querySelector('.carousel-arrow--previous').addEventListener('click', () => move(-1));
document.querySelector('.carousel-arrow--next').addEventListener('click', () => move(1));
carousel.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
carousel.addEventListener('pointerdown', (event) => {
  if (centering || event.button !== 0 || event.target.closest('.carousel-arrow')) return;
  cancelRotation();
  targetPosition = position;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, start: position, lastX: event.clientX, lastTime: performance.now(), velocity: 0, moved: false, axis: null };
});
carousel.addEventListener('pointermove', (event) => {
  if (!pointer || event.pointerId !== pointer.id) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  if (!pointer.axis) {
    if (Math.hypot(dx, dy) < 8) return;
    pointer.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
  }
  if (pointer.axis === 'vertical') return;
  if (!pointer.moved) { pointer.moved = true; carousel.setPointerCapture(event.pointerId); carousel.classList.add('is-dragging'); }
  const now = performance.now();
  pointer.velocity = (event.clientX - pointer.lastX) / Math.max(now - pointer.lastTime, 1);
  pointer.lastX = event.clientX;
  pointer.lastTime = now;
  const spacing = Math.min(carousel.clientWidth < 700 ? carousel.clientWidth * .19 : carousel.clientWidth * .105, 175);
  position = pointer.start - dx / spacing;
  render();
});
function endDrag(event) {
  if (!pointer || event.pointerId !== pointer.id) return;
  if (pointer.moved) {
    const spacing = Math.min(carousel.clientWidth < 700 ? carousel.clientWidth * .19 : carousel.clientWidth * .105, 175);
    const momentum = reducedMotion.matches ? 0 : Math.max(-1.5, Math.min(1.5, pointer.velocity * 180 / spacing));
    const target = ((Math.round(position - momentum) % files.length) + files.length) % files.length;
    carousel.classList.remove('is-dragging');
    rotateTo(target);
    status.textContent = `Image ${target + 1} of ${files.length}`;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
  }
  pointer = null;
}
carousel.addEventListener('pointerup', endDrag);
carousel.addEventListener('pointercancel', endDrag);
window.addEventListener('resize', render);
new ResizeObserver(render).observe(carousel);

function imageContentRect(image) {
  const rect = image.getBoundingClientRect();
  const ratio = image.naturalWidth / image.naturalHeight;
  if (!ratio || !rect.width || !rect.height) return rect;
  const width = Math.min(rect.width, rect.height * ratio);
  const height = Math.min(rect.height, rect.width / ratio);
  return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height };
}

function animateImage(from, to) {
  if (reducedMotion.matches || !from.width || !to.width) return Promise.resolve();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return enlarged.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: .7 },
    { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 }
  ], { duration: 550, easing: 'cubic-bezier(.22, 1, .36, 1)' }).finished.catch(() => {});
}

async function selectImage(index) {
  if (centering || dialog.open) return;
  centering = true;
  const card = cards[index];
  status.textContent = `Image ${index + 1} of ${files.length}`;
  await rotateTo(index);
  openImage(card, files[index]);
  centering = false;
}

function loadFullImage(card, file) {
  const request = ++imageRequest;
  const full = new Image();
  full.onload = async () => {
    try { await full.decode(); } catch (_) { return; }
    if (request === imageRequest && dialog.open && selectedCard === card && !closing) enlarged.src = full.src;
  };
  full.src = `./assets/gallery/view/${file}`;
}

function openImage(card, file) {
  selectedCard = card;
  const from = imageContentRect(card.querySelector('img'));
  card.style.visibility = 'hidden';
  enlarged.src = `./assets/gallery/thumbs/${file}`;
  enlarged.alt = card.getAttribute('aria-label').replace('Open ', '');
  dialog.showModal();
  const to = enlarged.getBoundingClientRect();
  animateImage(from, to);
  if (!reducedMotion.matches) dialog.animate([{ backgroundColor: 'rgba(255,255,255,0)' }, { backgroundColor: 'rgba(255,255,255,1)' }], { duration: 650, easing: 'ease-in-out' });
  if (!reducedMotion.matches) dialogArrows.forEach((arrow) => arrow.animate([{ opacity: 0, transform: 'translateY(-50%) scale(.15)' }, { opacity: 1, transform: 'translateY(-50%) scale(1)' }], { duration: 650, easing: 'cubic-bezier(.22, 1, .36, 1)' }));
  loadFullImage(card, file);
  closeButton.focus();
}

async function switchImage(direction, fromSwipe = false) {
  if (switching || closing || !dialog.open) return;
  switching = true;
  imageRequest++;
  const index = (cards.indexOf(selectedCard) + direction + files.length) % files.length;
  const nextCard = cards[index];
  const rect = enlarged.getBoundingClientRect();
  const outgoing = enlarged.cloneNode();
  outgoing.className = 'image-dialog-exiting';
  outgoing.setAttribute('aria-hidden', 'true');
  outgoing.style.transform = '';
  Object.assign(outgoing.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  dialog.appendChild(outgoing);
  enlarged.style.transform = '';
  selectedCard.style.visibility = '';
  selectedCard = nextCard;
  nextCard.style.visibility = 'hidden';
  position = index;
  targetPosition = index;
  render();
  enlarged.src = `./assets/gallery/thumbs/${files[index]}`;
  enlarged.alt = nextCard.getAttribute('aria-label').replace('Open ', '');
  dialogStatus.textContent = `Image ${index + 1} of ${files.length}`;
  status.textContent = dialogStatus.textContent;

  if (!reducedMotion.matches) {
    const options = { duration: 350, easing: 'cubic-bezier(.22, 1, .36, 1)' };
    const distance = fromSwipe ? Math.min(dialog.clientWidth * .35, 180) : 80;
    const outgoingMotion = outgoing.animate([{ transform: 'translateX(0) scale(1)', opacity: 1 }, { transform: `translateX(${-direction * distance}px) scale(.96)`, opacity: 0 }], options);
    const incomingMotion = enlarged.animate([{ transform: `translateX(${direction * distance}px) scale(.96)`, opacity: 0 }, { transform: 'translateX(0) scale(1)', opacity: 1 }], options);
    await Promise.all([outgoingMotion.finished, incomingMotion.finished].map((finished) => finished.catch(() => {})));
  }
  outgoing.remove();
  loadFullImage(nextCard, files[index]);
  switching = false;
}

async function closeImage() {
  if (closing || switching || !dialog.open) return;
  closing = true;
  imageRequest++;
  if (!reducedMotion.matches && selectedCard?.isConnected) {
    const to = imageContentRect(selectedCard.querySelector('img'));
    const from = enlarged.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const options = { duration: 650, easing: 'cubic-bezier(.32, 0, .18, 1)', fill: 'forwards' };
    const motion = enlarged.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: 1 }], options);
    dialog.animate([{ backgroundColor: 'rgba(255,255,255,1)' }, { backgroundColor: 'rgba(255,255,255,0)' }], options);
    closeButton.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
    dialogArrows.forEach((arrow) => arrow.animate([{ opacity: 1, transform: 'translateY(-50%) scale(1)' }, { opacity: 0, transform: 'translateY(-50%) scale(.7)' }], { duration: 350, fill: 'forwards' }));
    await motion.finished.catch(() => {});
  }
  dialog.close();
  if (selectedCard) selectedCard.style.visibility = '';
  closeButton.getAnimations().forEach((animation) => animation.cancel());
  dialogArrows.forEach((arrow) => arrow.getAnimations().forEach((animation) => animation.cancel()));
  dialog.getAnimations().forEach((animation) => animation.cancel());
  enlarged.getAnimations().forEach((animation) => animation.cancel());
  selectedCard?.focus();
  closing = false;
}
closeButton.addEventListener('click', closeImage);
document.querySelector('.image-dialog-arrow--previous').addEventListener('click', () => switchImage(-1));
document.querySelector('.image-dialog-arrow--next').addEventListener('click', () => switchImage(1));
dialog.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    switchImage(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeImage(); });
dialog.addEventListener('click', (event) => { if (event.target === dialog && !suppressViewerClick) closeImage(); });

dialog.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch' || !event.isPrimary || switching || closing || event.target.closest('button')) return;
  viewerSwipe = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastTime: performance.now(), velocity: 0, axis: null, offset: 0 };
});
dialog.addEventListener('pointermove', (event) => {
  if (!viewerSwipe || event.pointerId !== viewerSwipe.id) return;
  const dx = event.clientX - viewerSwipe.x;
  const dy = event.clientY - viewerSwipe.y;
  if (!viewerSwipe.axis) {
    if (Math.hypot(dx, dy) < 8) return;
    viewerSwipe.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    if (viewerSwipe.axis === 'horizontal') {
      enlarged.getAnimations().forEach((animation) => animation.cancel());
      dialog.setPointerCapture(event.pointerId);
    }
  }
  if (viewerSwipe.axis !== 'horizontal') return;
  const now = performance.now();
  viewerSwipe.velocity = (event.clientX - viewerSwipe.lastX) / Math.max(now - viewerSwipe.lastTime, 1);
  viewerSwipe.lastX = event.clientX;
  viewerSwipe.lastTime = now;
  viewerSwipe.offset = Math.max(-dialog.clientWidth * .7, Math.min(dialog.clientWidth * .7, dx));
  enlarged.style.transform = `translateX(${viewerSwipe.offset}px)`;
});
function finishViewerSwipe(event) {
  if (!viewerSwipe || event.pointerId !== viewerSwipe.id) return;
  const swipe = viewerSwipe;
  viewerSwipe = null;
  if (swipe.axis !== 'horizontal') return;
  suppressViewerClick = true;
  setTimeout(() => { suppressViewerClick = false; }, 0);
  const shouldAdvance = event.type !== 'pointercancel' && (Math.abs(swipe.offset) > Math.min(90, dialog.clientWidth * .2) || (Math.abs(swipe.offset) > 18 && Math.abs(swipe.velocity) > .45));
  if (shouldAdvance) {
    switchImage(swipe.offset < 0 ? 1 : -1, true);
  } else {
    enlarged.style.transform = '';
    if (!reducedMotion.matches) enlarged.animate([{ transform: `translateX(${swipe.offset}px)` }, { transform: 'translateX(0)' }], { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  }
}
dialog.addEventListener('pointerup', finishViewerSwipe);
dialog.addEventListener('pointercancel', finishViewerSwipe);
render();
