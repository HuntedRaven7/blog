export class Gallery {
  constructor(config, renderer) {
    this.config = config;
    this.renderer = renderer;
    this.container = null;
    this.POLL_MS = 3000;
    this.pollTimer = null;
    this.signature = null;
  }

  getImageSrc(name) {
    const base = (this.config.baseUrl || "").replace(/\/+$/, "");
    return `${base}/images/${name}`;
  }

  async mount(container) {
    this.container = container;
    container.innerHTML = `
      <div class="gallery-wrap">
        <h1>Photos</h1>
        <div class="gallery-sub" id="gallery-intro"></div>
        <div class="gallery-loading">Loading gallery…</div>
        <div class="gallery-grid" hidden></div>
        <div class="gallery-empty" hidden>No images yet. Add some to <code>content/images/</code>.</div>
      </div>
    `;
    await this.refresh();
    this.pollTimer = setInterval(() => this.refresh(), this.POLL_MS);
  }

  async loadIntro() {
    const el = this.container.querySelector("#gallery-intro");
    if (!el) return;
    try {
      const base = (this.config.baseUrl || "").replace(/\/+$/, "");
      const response = await fetch(`${base}/gallery-intro.md`, { cache: "no-store" });
      if (!response.ok) throw new Error("intro not found");
      const markdown = await response.text();
      if (markdown === this.introSignature) return;
      this.introSignature = markdown;
      el.innerHTML = this.renderer ? this.renderer.render(markdown) : markdown;
    } catch {
      if (el.innerHTML !== "") el.innerHTML = "";
    }
  }

  destroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async refresh() {
    await this.loadIntro();
    try {
      const response = await fetch(`gallery.json`, { cache: "no-store" });
      if (!response.ok) throw new Error("gallery fetch failed");
      const data = await response.json();
      const next = data.images || [];
      const sig = next.map((i) => i.name).join("\n");
      if (sig !== this.signature) {
        this.signature = sig;
        this.render(next);
      }
    } catch (err) {
      this.renderError();
    }
  }

  renderError() {
    if (this.renderedOnce) return;
    this.renderedOnce = true;
    const loading = this.container.querySelector(".gallery-loading");
    const empty = this.container.querySelector(".gallery-empty");
    if (loading) loading.remove();
    if (empty) empty.hidden = false;
  }

  render(images) {
    const loading = this.container.querySelector(".gallery-loading");
    const grid = this.container.querySelector(".gallery-grid");
    const empty = this.container.querySelector(".gallery-empty");
    if (loading) loading.remove();

    grid.hidden = images.length === 0;
    empty.hidden = images.length !== 0;
    grid.innerHTML = "";

    images.forEach((img, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "gallery-item";
      item.setAttribute("data-name", img.name);
      item.setAttribute("aria-label", `open ${img.name}`);
      item.innerHTML = `<img src="${this.getImageSrc(img.name)}" alt="${img.name}" loading="lazy" />`;
      item.addEventListener("click", () => this.openLightbox(images, index));
      grid.appendChild(item);
    });
  }

  openLightbox(images, index) {
    let current = index;
    const overlay = document.createElement("div");
    overlay.className = "lightbox";
    const render = () => {
      const img = images[current];
      overlay.innerHTML = `
        <button class="lb-close" type="button" aria-label="Close">&times;</button>
        <button class="lb-prev" type="button" aria-label="Previous">&#8249;</button>
        <figure class="lb-figure">
          <img src="${this.getImageSrc(img.name)}" alt="${img.name}" />
          <figcaption>${img.name}</figcaption>
        </figure>
        <button class="lb-next" type="button" aria-label="Next">&#8250;</button>
      `;
    };
    render();
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    const step = (dir) => {
      current = (current + dir + images.length) % images.length;
      render();
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKey);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
      if (e.target.closest(".lb-close")) close();
      if (e.target.closest(".lb-prev")) step(-1);
      if (e.target.closest(".lb-next")) step(1);
    });
  }
}
