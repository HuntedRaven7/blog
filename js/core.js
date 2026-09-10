import { Router } from "./router.js?v=202609052";
import { Renderer } from "./renderer.js?v=202609052";
import { PocketPet } from "./pet.js?v=202609052";
import { SearchPalette } from "./search.js?v=202609052";
import { initReadingProgress } from "./ui.js?v=202609052";
import { initVisitorWidget } from "./visitors.js?v=202609052";
import { initActivityWidget } from "./activity.js?v=202609052";

class Markdownium {
  constructor() {
    this.config = null;
    this.router = null;
    this.renderer = null;
  }

  async init() {
    try {
      await this.loadConfig();
      this.setupRenderer();
      this.setupRouter();
      this.initializeUI();
      const hash = window.location.hash;
      if (hash && hash !== "#/") {
        this.router.navigate(hash);
      } else {
        this.router.navigate("#/home");
      }
    } catch (error) {
      this.showError("Failed to initialize M↓ium: " + error.message);
    }
  }

  async loadConfig() {
    const response = await fetch("./config.json");
    if (!response.ok) throw new Error("config not found, somehow");
    this.config = await response.json();
  }

  setupRenderer() {
    this.renderer = new Renderer(this.config);
  }

  setupRouter() {
    this.router = new Router(this.config, this.renderer);
    this.router.onRouteChange = (page) => this.syncPet(page);

    window.addEventListener("popstate", () => {
      this.router.navigate(window.location.hash || "/");
    });

    document.addEventListener("click", (e) => {
      const toggle = e.target.closest ? e.target.closest("#search-toggle") : null;
      if (toggle) {
        e.preventDefault();
        if (this.search) this.search.open();
        return;
      }
      if (e.target.tagName === "A") {
        const href = e.target.getAttribute("href");
        if (href && href.startsWith("/#/")) {
          e.preventDefault();
          this.router.navigate(href);
        } else if (
          e.target.href &&
          e.target.href.startsWith(window.location.origin)
        ) {
          e.preventDefault();
          const path = new URL(e.target.href).pathname;
          this.router.navigate(path);
        }
      }
    });
  }

  async initializeUI() {
    document.getElementById("site-logo").src = this.config.logo;
    document.getElementById("site-name").textContent = this.config.siteName;
    document.getElementById("license-badge").innerHTML =
      this.config.licenseBadge;
    document.title = this.config.siteName;

    initReadingProgress();

    this.pet = null;

    this.loadTopLinks();

    try {
      await this.loadSidebar();
    } catch (error) {
      console.warn("sidebar failed to load:", error);
    }
    const sidebar = document.getElementById("sidebar");
    initVisitorWidget(sidebar);
    initActivityWidget(sidebar);

    this.search = new SearchPalette(this.config, (slug, anchor) => {
      this.router.navigate(`#/${slug}${anchor ? "#" + anchor : ""}`);
    });
    this.search.init();
  }

  syncPet(page) {
    this.currentPage = page;
    if (page === "home") {
      if (!this.pet) {
        this.pet = new PocketPet();
        this.pet.init().then(() => {
          if (this.currentPage === "home") this.pet.setVisible(true);
        });
      } else {
        this.pet.setVisible(true);
      }
    } else if (this.pet) {
      this.pet.setVisible(false);
    }
  }

  async loadSidebar() {
    const { text: sidebarContent } = await this.router.fetchContent("sidebar");
    const sidebarElement = document.getElementById("sidebar");
    sidebarElement.innerHTML = this.renderer.render(sidebarContent);
  }

  async loadTopLinks() {
    try {
      const { text: topContent } = await this.router.fetchContent("top");
      const topElement = document.getElementById("top-links");
      topElement.innerHTML = this.renderer.render(topContent);
      topElement.querySelectorAll("a").forEach((a) => {
        const rawHref = a.getAttribute("href") || "";
        if (
          rawHref.startsWith("https://files.obsidianos.xyz/") ||
          rawHref.startsWith("//files.obsidianos.xyz/")
        ) {
          const text = a.nextSibling;
          a.remove();
          if (text && text.nodeType === 3 && text.textContent.trim() === "") {
            text.remove();
          }
        }
      });
    } catch (error) {}
    const topElement = document.getElementById("top-links");
    const existingLinks = topElement.querySelectorAll("a");
    const hasMainSite = Array.from(existingLinks).some(
      (a) => a.href === "https://huntedraven7.github.io/"
    );
    if (!hasMainSite) {
      const mainSite = document.createElement("a");
      mainSite.href = "https://huntedraven7.github.io/";
      mainSite.target = "_blank";
      mainSite.rel = "noopener";
      mainSite.textContent = "main site";
      topElement.appendChild(mainSite);
    }
    this.syncActiveNav();
  }

  syncActiveNav() {
    const page = window.location.hash.replace(/^#\//, "").split("#")[0] || "home";
    if (this.router) this.router.setActiveNav(page);
  }

  showError(message) {
    document.getElementById("content").innerHTML =
      `<div class="error">${message}</div>`;
  }
}

const app = new Markdownium();
app.init();
