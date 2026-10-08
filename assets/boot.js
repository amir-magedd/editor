/* runs before the page paints: enables the entrance animations (no-JS visitors just see the page) */
(function () {
  var d = document.documentElement;
  try { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) d.classList.add('js-anim'); } catch (e) {}
  setTimeout(function () { if (!d.classList.contains('ready')) d.classList.add('anim-safety'); }, 4000); /* if scripts fail, never leave content hidden */
})();
