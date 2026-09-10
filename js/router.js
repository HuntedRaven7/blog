import { Terminal } from "./terminal.js?v=202609052";
import { Graph } from "./graph.js?v=202609052";
import { Gallery } from "./gallery.js?v=202609052";
import { enhancePlaylist } from "./playlist.js?v=202609052";
import { enhanceCodeBlocks } from "./renderer.js?v=202609052";
import {
  trackView,
  getViews,
  formatCount,
  readingTime,
  formatUpdated,
} from "./stats.js?v=202609052";

export class Router {
  constructor(config, renderer) {
    this.config = config;
    this.renderer = renderer;
    this.terminal = null;
    this.graph = null;
    this.onRouteChange = null;
  }

  async navigate(path) {
    const route = this.parsePath(path);
    const contentElement = document.getElementById("content");
    contentElement.innerHTML = '<div class="loading">Loading...</div>';
    this.setActiveNav(route.page);
    if (this.onRouteChange) this.onRouteChange(route.page);

    if (this.gallery && !["photos", "photo", "gallery"].includes(route.page)) {
      this.gallery.destroy();
      this.gallery = null;
    }

    if (route.page === "terminal") {
      if (!this.terminal) this.terminal = new Terminal(this, this.config);
      await this.terminal.mount(contentElement);
      window.history.pushState({}, "", `#/terminal`);
      window.scrollTo(0, 0);
      return;
    }

    if (route.page === "graph") {
      if (this.graph) this.graph.destroy();
      this.graph = new Graph(this, this.config);
      await this.graph.mount(contentElement);
      window.history.pushState({}, "", `#/graph`);
      window.scrollTo(0, 0);
      return;
    }

    if (route.page === "photos" || route.page === "photo" || route.page === "gallery") {
      this.gallery = new Gallery(this.config, this.renderer);
      await this.gallery.mount(contentElement);
      window.history.pushState({}, "", `#/photos`);
      window.scrollTo(0, 0);
      return;
    }

    try {
      const { text: content, lastModified } = await this.fetchContent(route.page);
      contentElement.innerHTML = this.renderer.render(content, route.page);
      enhancePlaylist(contentElement);
      enhanceCodeBlocks(contentElement);
      this.attachMeta(contentElement, route.page, content, lastModified);
      window.history.pushState(
        {},
        "",
        `#/${route.page}${route.hash ? "#" + route.hash : ""}`,
      );

      if (route.hash) {
        setTimeout(() => {
          const element = document.getElementById(route.hash);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 300);
      } else {
        window.scrollTo(0, 0);
      }
    } catch (error) {
      contentElement.innerHTML = `<div class="error" onclick="alert('pedantic people will know this is actually 200 but stfu')" style="cursor: pointer; text-decoration: underline;">error 404*; ${route.page}</div>`;
    }
  }

  setActiveNav(page) {
    document.querySelectorAll(".top-links a").forEach((a) => {
      const rawHref = (a.getAttribute("href") || "")
        .replace(/^\/#\//, "")
        .replace(/^\//, "");
      const isActive =
        rawHref !== "" && rawHref === page;
      a.classList.toggle("active", isActive);
    });
  }

  parsePath(path) {
    if (path.startsWith("#/")) {
      const hashPath = path.substring(2);
      const [page, ...hashParts] = hashPath.split("#");
      return {
        page: page || "home",
        hash: hashParts.length > 0 ? hashParts.join("#") : null,
      };
    } else if (path.startsWith("/#/")) {
      const hashPath = path.substring(3);
      const [page, ...hashParts] = hashPath.split("#");
      return {
        page: page || "home",
        hash: hashParts.length > 0 ? hashParts.join("#") : null,
      };
    } else {
      if (path === "/" || path === "") return { page: "home", hash: null };
      return { page: path.substring(1), hash: null };
    }
  }

  attachMeta(container, page, markdown, lastModified) {
    trackView(page);
    const views = getViews(page);
    const bits = [];
    if (lastModified) {
      const updated = formatUpdated(new Date(lastModified));
      if (updated) bits.push(`last updated ${updated}`);
    }
    bits.push(`${readingTime(markdown)} min read`);
    bits.push(`${formatCount(views)} views`);

    const meta = document.createElement("div");
    meta.className = "page-meta";
    meta.textContent = bits.join("  ·  ");

    const heading = container.querySelector("h1, h2, h3");
    if (heading) {
      heading.after(meta);
    } else {
      container.prepend(meta);
    }
  }

  async fetchContent(route) {
    const url = `${this.config.baseUrl}/${route}.md`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (!response.ok) throw new Error("content not found");
    return {
      text: await response.text(),
      lastModified: response.headers.get("Last-Modified"),
    };
  }
}
