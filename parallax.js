const textPages = [...document.querySelectorAll('.text-page')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let frame = 0;

function updateParallax() {
  frame = 0;
  textPages.forEach((page) => {
    if (page.hidden) return;
    const scrolled = Math.max(0, -page.getBoundingClientRect().top);
    const visualLimit = page.classList.contains('about-page') ? 30 : 75;
    page.style.setProperty('--parallax-visual', `${Math.min(scrolled * .10, visualLimit)}px`);
    page.style.setProperty('--parallax-copy', `${Math.min(scrolled * .025, 20)}px`);
  });
}

function scheduleParallax() {
  if (reducedMotion.matches) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    textPages.forEach((page) => {
      page.style.removeProperty('--parallax-visual');
      page.style.removeProperty('--parallax-copy');
    });
    return;
  }
  if (!frame) frame = requestAnimationFrame(updateParallax);
}

window.addEventListener('scroll', scheduleParallax, { passive: true });
window.addEventListener('resize', scheduleParallax);
reducedMotion.addEventListener('change', scheduleParallax);
textPages.forEach((page) => new MutationObserver(scheduleParallax).observe(page, { attributes: true, attributeFilter: ['hidden'] }));
scheduleParallax();
