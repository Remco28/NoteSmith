/**
 * Scroll a panel (not the page) so `el` is in view, centring it when it was
 * out of sight. Does nothing when it is already fully visible, so following
 * the pointer never jiggles a panel that already shows the item.
 */
export function revealInPanel(panel: HTMLElement | null, el: HTMLElement | null): void {
  if (!panel || !el) return;
  const p = panel.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.top >= p.top && r.bottom <= p.bottom) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const target = panel.scrollTop + (r.top - p.top) - (p.height - Math.min(r.height, p.height)) / 2;
  panel.scrollTo({ top: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
}
