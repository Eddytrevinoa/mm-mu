const header = document.querySelector('.site-header');
const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-navigation');
const mobile = window.matchMedia('(max-width: 700px)');

function setOpen(open, returnFocus = false) {
  const expanded = mobile.matches && open;
  header.classList.toggle('menu-open', expanded);
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
  navigation.inert = mobile.matches && !expanded;
  if (returnFocus && mobile.matches) toggle.focus();
}

setOpen(false);
header.classList.add('menu-ready');
toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) setOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    event.preventDefault();
    setOpen(false, true);
  }
});
document.addEventListener('pointerdown', (event) => {
  if (toggle.getAttribute('aria-expanded') === 'true' && !header.contains(event.target)) setOpen(false);
});
mobile.addEventListener('change', () => setOpen(false));
