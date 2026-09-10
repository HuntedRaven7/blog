const MAX_RESULTS = 12;

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  let qi = 0;
  let score = 0;
  let streak = 0;
  let prev = -2;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] !== q[qi]) continue;
    qi++;
    streak = i === prev + 1 ? streak + 1 : 1;
    prev = i;
    let bonus = 1;
    if (i === 0) bonus += 3;
    if (/[\s\-_\/+({]/.test(t[i - 1] || "")) bonus += 2;
    if (streak > 1) bonus += streak;
    if (qi === q.length && i === t.length - 1) bonus += 2;
    score += bonus;
  }
  return qi >= q.length ? score : -1;
}

function highlightMatches(text, query) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return escapeHtml(text);
  const out = [];
  let qi = 0;
  let last = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] !== q[qi]) continue;
    if (i > last) out.push(escapeHtml(text.slice(last, i)));
    out.push(`<mark class="hl">${escapeHtml(text[i])}</mark>`);
    last = i + 1;
    qi++;
  }
  if (last < text.length) out.push(escapeHtml(text.slice(last)));
  return out.join("");
}

function cleanHeading(raw) {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

function toHeaderId(title) {
  return title
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function extractHeadings(md) {
  const headings = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const title = cleanHeading(m[2]);
    if (title) headings.push({ title, id: toHeaderId(title) });
  }
  return headings;
}

function plainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, " ")
    .replace(/%GAP%/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}[>|+-]\s+/gm, " ")
    .replace(/[*_`~]|<\/?[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

function summarize(text) {
  if (!text) return "";
  return text.length > 150 ? text.slice(0, 150).trimEnd() + "…" : text;
}

export class SearchPalette {
  constructor(config, onSelect) {
    this.config = config;
    this.onSelect = onSelect;
    this.entries = [];
    this.pageEntries = [];
    this.results = [];
    this.selected = 0;
    this.ready = false;
    this.buildDOM();
    this.wire();
  }

  async init() {
    let pages = [];
    try {
      const res = await fetch("./files.json", { cache: "no-store" });
      if (res.ok) pages = await res.json();
    } catch {}
    if (!Array.isArray(pages) || !pages.length) {
      pages = await this.discoverPages();
    }
    await this.buildIndex(pages);
    this.ready = true;
  }

  async discoverPages() {
    const slugs = new Set(["home"]);
    for (const file of ["sidebar", "top"]) {
      try {
        const res = await fetch(`${this.config.baseUrl}/${file}.md`, {
          cache: "no-store",
        });
        if (!res.ok) continue;
        const md = await res.text();
        for (const m of md.matchAll(/\]\(([^)#]+)/g)) {
          const slug = m[1].trim().replace(/^\/?/, "");
          if (slug) slugs.add(slug);
        }
      } catch {}
    }
    return [...slugs].map((slug) => ({ slug, title: slug }));
  }

  async buildIndex(pages) {
    const cache = new Map();
    const add = (entry) => {
      this.entries.push(entry);
      if (entry.type === "page") this.pageEntries.push(entry);
    };

    add({
      slug: "terminal",
      title: "Terminal",
      type: "page",
      anchor: null,
      sub: "poke around this cozy nest from the command line",
      haystack: "terminal guest@nest shell commands prompt",
    });

    add({
      slug: "graph",
      title: "Second Brain",
      type: "page",
      anchor: null,
      sub: "all the notes and how they link together",
      haystack: "graph second brain map neural links overview",
    });

    for (const page of pages) {
      const slug = page.slug || "";
      if (!slug) continue;
      let md = "";
      if (!cache.has(slug)) {
        try {
          const res = await fetch(`${this.config.baseUrl}/${slug}.md`, {
            cache: "no-store",
          });
          if (res.ok) md = await res.text();
        } catch {}
        cache.set(slug, md);
      }

      const title = page.title || slug;
      const text = plainText(md);
      const sub = summarize(text);
      add({
        slug,
        title,
        type: "page",
        anchor: null,
        sub,
        haystack: `${title} ${text}`,
      });

      for (const h of extractHeadings(md)) {
        add({
          slug,
          title: h.title,
          type: "heading",
          anchor: h.id,
          sub: title,
          haystack: `${h.title} ${title} ${text}`,
        });
      }
    }
  }

  search(query) {
    const q = (query || "").trim();
    if (!q) {
      return this.pageEntries
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title));
    }
    const scored = [];
    for (const entry of this.entries) {
      const score = fuzzyScore(q, `${entry.title} ${entry.sub}`);
      if (score > 0) scored.push({ entry, score });
    }
    scored.sort(
      (a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title),
    );
    return scored.slice(0, MAX_RESULTS).map((x) => x.entry);
  }

  buildDOM() {
    this.overlay = document.createElement("div");
    this.overlay.className = "search-overlay";
    this.overlay.hidden = true;
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-label", "Search");
    this.overlay.innerHTML = `
      <div class="search-palette">
        <div class="search-input-wrap">
          <span class="search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line></svg></span>
          <input id="search-input" type="text" placeholder="Search pages…"
                 autocomplete="off" spellcheck="false" aria-label="Search pages" />
          <kbd class="search-kbd">esc</kbd>
        </div>
        <ul id="search-results" class="search-results"></ul>
        <div class="search-footer">
          <span><kbd class="search-kbd">↑</kbd><kbd class="search-kbd">↓</kbd> navigate</span>
          <span><kbd class="search-kbd">↵</kbd> open</span>
          <span>fuzzy matching</span>
        </div>
      </div>`;
    document.body.appendChild(this.overlay);
    this.input = this.overlay.querySelector("#search-input");
    this.resultsEl = this.overlay.querySelector("#search-results");
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  wire() {
    this.input.addEventListener("input", () => {
      this.selected = 0;
      this.renderResults();
    });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.move(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.pick(this.selected);
      }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.toggle();
        return;
      }
      if (e.key === "Escape" && !this.overlay.hidden) {
        e.preventDefault();
        this.close();
      }
    });
  }

  move(delta) {
    if (!this.results.length) return;
    this.selected = Math.min(
      Math.max(0, this.selected + delta),
      this.results.length - 1,
    );
    this.renderResults();
  }

  pick(index) {
    const entry = this.results[index];
    if (!entry) return;
    this.close();
    if (this.onSelect) this.onSelect(entry.slug, entry.anchor);
  }

  renderResults() {
    const q = this.input.value;
    this.results = this.search(q);
    this.selected = Math.min(this.selected, Math.max(0, this.results.length - 1));
    this.resultsEl.innerHTML = "";

    if (!this.results.length) {
      const empty = document.createElement("li");
      empty.className = "search-empty";
      empty.textContent = "No matches — try something else";
      this.resultsEl.appendChild(empty);
      return;
    }

    this.results.forEach((entry, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-result-item" + (i === this.selected ? " selected" : "");
      btn.innerHTML =
        `<span class="search-result-head">` +
        `<span class="search-result-title">${highlightMatches(entry.title, q)}</span>` +
        `<span class="search-result-type">${entry.type === "heading" ? "heading" : "page"}</span>` +
        `</span>` +
        (entry.sub
          ? `<span class="search-result-sub">${highlightMatches(entry.sub, q)}</span>`
          : "");
      btn.addEventListener("click", () => this.pick(i));
      btn.addEventListener("mouseenter", () => {
        this.selected = i;
        this.resultsEl
          .querySelectorAll(".search-result-item")
          .forEach((el, j) => el.classList.toggle("selected", j === i));
      });
      li.appendChild(btn);
      this.resultsEl.appendChild(li);
    });
  }

  open() {
    this.overlay.hidden = false;
    this.input.value = "";
    this.selected = 0;
    this.renderResults();
    this.input.focus();
  }

  close() {
    this.overlay.hidden = true;
    this.input.blur();
  }

  toggle() {
    if (this.overlay.hidden) this.open();
    else this.close();
  }
}