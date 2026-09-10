function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  const palette = [
    "#7c5cff",
    "#ffb86b",
    "#ff6b8b",
    "#7fb4ca",
    "#ff9d5c",
    "#9bdc8a",
  ];
  return palette[Math.abs(h) % palette.length];
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const NS = "http://www.w3.org/2000/svg";

export class Graph {
  constructor(router, config) {
    this.router = router;
    this.config = config || {};
    this.nodes = [];
    this.edges = [];
    this.forceLinks = [];
    this.edgeEls = [];
    this.nodeEls = [];
    this.raf = null;
    this.hovered = null;
    this.onResize = null;
    this.mounted = true;
  }

  destroy() {
    this.mounted = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.onResize) window.removeEventListener("resize", this.onResize);
    this.onResize = null;
  }

  async mount(container) {
    container.innerHTML = `
      <div class="graph-view">
        <div class="graph-titlebar">
          <span class="graph-dots"><span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span></span>
          <span class="graph-title">second&nbsp;brain &middot; neural map</span>
          <span class="graph-spacer"></span>
          <a class="graph-exit" href="/home" title="close">&#10005;</a>
        </div>
        <div class="graph-body">
          <svg class="graph-svg" id="graph-svg" role="img" aria-label="map of the notes and how they link together"></svg>
          <div class="graph-hint" id="graph-hint">
            <span class="graph-hint-title">second brain</span>
            <span class="graph-hint-sub" id="graph-hint-sub">click a note to open it &middot; hover to peek the name</span>
          </div>
          <div class="graph-legend">
            <span class="graph-legend-item"><i class="legend-swatch swatch-you"></i>home</span>
            <span class="graph-legend-item"><i class="legend-swatch swatch-link"></i>note</span>
            <span class="graph-legend-item"><i class="legend-line"></i>a thread between notes</span>
          </div>
        </div>
      </div>`;

    this.container = container;
    this.svg = container.querySelector("#graph-svg");
    this.hintSub = container.querySelector("#graph-hint-sub");

    await this.loadGraph();
    if (!this.nodes.length) {
      this.svg.parentElement.innerHTML = `
        <div class="graph-empty">nothing to map yet &mdash; add some notes and they will appear here</div>`;
      return;
    }
    this.setupSvg();
    this.buildElements();
    this.bindEvents();
    this.render();
    this.raf = requestAnimationFrame(() => this.tick());
  }

  async loadGraph() {
    let pages = [];
    try {
      const res = await fetch("files.json", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        pages = Array.isArray(data) ? data : [];
      }
    } catch {
      pages = [];
    }

    const allSlugs = new Set(pages.map((p) => p.slug));

    const nodes = pages.map((p) => ({
      id: p.slug,
      label: p.title || p.slug,
      x: (Math.random() - 0.5) * 500,
      y: (Math.random() - 0.5) * 300,
      vx: 0,
      vy: 0,
    }));

    const edges = [];
    const edgeKey = new Set();

    const addEdge = (from, to) => {
      if (from === to) return;
      if (!allSlugs.has(to)) return;
      const key = [from, to].sort().join("::");
      if (edgeKey.has(key)) return;
      edgeKey.add(key);
      edges.push({ source: from, target: to });
    };

    for (const page of pages) {
      try {
        const res = await fetch(
          `${this.config.baseUrl}/${page.slug}.md`,
          { cache: "no-store" },
        );
        if (!res.ok) continue;
        const md = await res.text();
        const linkRe = /\[[^\]]*\]\(\/([^)#/]+)([^)]*)\)/g;
        let m;
        while ((m = linkRe.exec(md))) {
          addEdge(page.slug, m[1]);
        }
      } catch {
        // skip pages that fail to load
      }
    }

    const degree = new Map(nodes.map((n) => [n.id, 0]));
    for (const e of edges) {
      degree.set(e.source, degree.get(e.source) + 1);
      degree.set(e.target, degree.get(e.target) + 1);
    }

    for (const n of nodes) {
      n.deg = degree.get(n.id) || 0;
      n.color = n.id === "home" ? "#4fd8c7" : hashColor(n.id);
      n.r = Math.min(20, 13 + n.deg * 1.8);
    }

    let start = nodes.find((n) => n.id === "home");
    if (!start && nodes.length) start = nodes[0];
    if (start) {
      start.x = 0;
      start.y = 0;
      start.r = 17;
    }

    this.nodes = nodes;
    this.edges = edges;
    this.buildForceLinks();
  }

  buildForceLinks() {
    const nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.forceLinks = this.edges.map((e) => ({
      source: nodeMap.get(e.source),
      target: nodeMap.get(e.target),
    }));
  }

  setupSvg() {
    const bbox = this.svg.getBoundingClientRect();
    this.width = Math.max(bbox.width, 420);
    this.height = Math.max(bbox.height, 460);

    this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
    this.svg.setAttribute("xmlns", NS);

    this.linkLayer = document.createElementNS(NS, "g");
    this.nodeLayer = document.createElementNS(NS, "g");
    this.svg.appendChild(this.linkLayer);
    this.svg.appendChild(this.nodeLayer);
  }

  buildElements() {
    this.linkLayer.innerHTML = "";
    this.nodeLayer.innerHTML = "";

    this.edgeEls = this.forceLinks.map(() => {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("class", "graph-link");
      this.linkLayer.appendChild(line);
      return line;
    });

    this.nodeEls = this.nodes.map((n) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "graph-node");
      g.__node = n;

      const title = document.createElementNS(NS, "title");
      title.textContent = n.label;

      const hit = document.createElementNS(NS, "circle");
      hit.setAttribute("class", "hit");
      hit.setAttribute("r", n.r + 9);

      const circle = document.createElementNS(NS, "circle");
      circle.setAttribute("class", "node-core");
      const fill = n.id === "home"
        ? "rgba(79, 216, 199, 0.92)"
        : hexToRgba(n.color, 0.92);
      circle.setAttribute("fill", fill);
      circle.setAttribute("stroke", n.color);
      circle.style.fill = fill;
      circle.style.stroke = n.color;
      circle.style.strokeWidth = "2.5";
      circle.style.filter = `drop-shadow(0 0 10px ${hexToRgba(n.color, 0.7)})`;
      if (n.id === "home") circle.classList.add("home");

      const rim = document.createElementNS(NS, "circle");
      rim.setAttribute("class", "rim");
      rim.setAttribute("r", n.r + 3);
      rim.setAttribute("fill", "none");
      rim.style.stroke = "rgba(255, 255, 255, 0.18)";
      rim.style.strokeWidth = "1";

      const label = document.createElementNS(NS, "text");
      label.setAttribute("class", "graph-label");
      label.setAttribute("text-anchor", "middle");
      label.style.fill = n.color;
      label.setAttribute("y", n.r + 14);
      const words = n.label.length > 24 ? n.label.slice(0, 23) + "…" : n.label;
      label.textContent = words;

      g.appendChild(title);
      g.appendChild(rim);
      g.appendChild(hit);
      g.appendChild(circle);
      g.appendChild(label);
      this.nodeLayer.appendChild(g);
      return { g, circle, label, node: n };
    });
  }

  bindEvents() {
    const onResize = () => {
      const bbox = this.svg.getBoundingClientRect();
      this.width = Math.max(bbox.width, 420);
      this.height = Math.max(bbox.height, 460);
      this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
    };
    this.onResize = onResize;
    window.addEventListener("resize", onResize);

    this.svg.addEventListener("mousemove", (e) => {
      const target = e.target.closest(".graph-node");
      this.hovered = target ? target.__node : null;
      if (target) this.hintSub.textContent = target.__node.label;
    });

    this.svg.addEventListener("mouseleave", () => {
      this.hovered = null;
      this.hintSub.textContent =
        "click a note to open it \u00b7 hover to peek the name";
    });

    this.svg.addEventListener("click", (e) => {
      const target = e.target.closest(".graph-node");
      if (target && target.__node) {
        e.stopPropagation();
        this.router.navigate("/" + target.__node.id);
      }
    });
  }

  isConnected(a, b) {
    return this.forceLinks.some(
      (l) =>
        (l.source.id === a.id && l.target.id === b.id) ||
        (l.target.id === a.id && l.source.id === b.id),
    );
  }

  tick() {
    if (!this.mounted) return;
    for (let i = 0; i < 4; i++) this.step();
    this.render();
    this.raf = requestAnimationFrame(() => this.tick());
  }

  step() {
    const repulsion = 5200;
    const linkLength = 230;
    const linkStrength = 0.045;
    const centerForce = 0.012;
    const damping = 0.86;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const nodes = this.nodes;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.hypot(dx, dy) || 1;
        if (dist < 70) dist = 70;
        const force = repulsion / (dist * dist);
        dx /= dist;
        dy /= dist;
        a.vx += dx * force;
        a.vy += dy * force;
        b.vx -= dx * force;
        b.vy -= dy * force;
      }
    }

    for (const link of this.forceLinks) {
      const a = link.source;
      const b = link.target;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy) || 1;
      const diff = dist - linkLength;
      const force = diff * linkStrength;
      dx /= dist;
      dy /= dist;
      a.vx += dx * force;
      a.vy += dy * force;
      b.vx -= dx * force;
      b.vy -= dy * force;
    }

    for (const n of nodes) {
      n.vx += (cx - n.x) * centerForce;
      n.vy += (cy - n.y) * centerForce;
      n.vx += (Math.random() - 0.5) * 0.06;
      n.vy += (Math.random() - 0.5) * 0.06;
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;

      const margin = 40;
      if (n.x < margin) { n.x = margin; n.vx *= -0.5; }
      if (n.x > this.width - margin) { n.x = this.width - margin; n.vx *= -0.5; }
      if (n.y < margin) { n.y = margin; n.vy *= -0.5; }
      if (n.y > this.height - margin) { n.y = this.height - margin; n.vy *= -0.5; }
    }
  }

  render() {
    const focus = this.hovered;

    for (let i = 0; i < this.edgeEls.length; i++) {
      const line = this.edgeEls[i];
      const l = this.forceLinks[i];
      line.setAttribute("x1", l.source.x);
      line.setAttribute("y1", l.source.y);
      line.setAttribute("x2", l.target.x);
      line.setAttribute("y2", l.target.y);
      if (focus) {
        const lit = l.source.id === focus.id || l.target.id === focus.id;
        line.classList.toggle("lit", lit);
        line.classList.toggle("faded", !lit);
      } else {
        line.classList.remove("lit", "faded");
      }
    }

    for (const ent of this.nodeEls) {
      const n = ent.node;
      ent.g.setAttribute(
        "transform",
        `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`,
      );
      const dimmed =
        focus !== null && focus.id !== n.id && !this.isConnected(focus, n);
      ent.g.classList.toggle("dimmed", dimmed);
    }
  }
}