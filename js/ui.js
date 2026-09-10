export function initReadingProgress() {
  const bar = document.createElement("div");
  bar.id = "reading-progress";
  document.body.appendChild(bar);

  const toTop = document.createElement("button");
  toTop.id = "back-to-top";
  toTop.type = "button";
  toTop.title = "Back to top";
  toTop.setAttribute("aria-label", "Back to top");
  toTop.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
  document.body.appendChild(toTop);

  let shown = false;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
    const show = window.scrollY > 320;
    if (show !== shown) {
      toTop.classList.toggle("show", show);
      shown = show;
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

  toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}