const cursorAvailable = window.matchMedia('(hover: hover) and (pointer: fine) and (forced-colors: none)');
const dot = document.createElement('div');
dot.className = 'custom-cursor-dot';
dot.setAttribute('aria-hidden', 'true');
document.body.appendChild(dot);
const viewer = document.querySelector('.image-dialog');
const interactive = 'a, button, input, textarea, select, summary, [role="button"], .about-sculpture';

function hideCursor() {
  document.documentElement.classList.remove('custom-cursor');
}

document.addEventListener('pointermove', (event) => {
  if (!cursorAvailable.matches || event.pointerType !== 'mouse') {
    hideCursor();
    return;
  }
  dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  dot.classList.toggle('is-interactive', !!event.target.closest(interactive));
  document.documentElement.classList.add('custom-cursor');
});

document.addEventListener('pointerout', (event) => {
  if (!event.relatedTarget) hideCursor();
});
window.addEventListener('blur', hideCursor);
document.addEventListener('visibilitychange', () => { if (document.hidden) hideCursor(); });
cursorAvailable.addEventListener('change', hideCursor);
new MutationObserver(() => {
  (viewer.open ? viewer : document.body).appendChild(dot);
}).observe(viewer, { attributes: true, attributeFilter: ['open'] });
