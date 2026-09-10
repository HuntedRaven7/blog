function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export class Terminal {
  constructor(router, config) {
    this.router = router;
    this.config = config || {};
    this.files = [];
    this.history = [];
    this.historyIndex = -1;
    this.tabMatches = [];
    this.tabIndex = 0;
    this.tabBase = "";
  }

  async mount(container) {
    container.innerHTML = `
      <div class="terminal">
        <div class="terminal-titlebar">
          <span class="terminal-dots"><span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span></span>
          <span class="terminal-title">guest@nest:&nbsp;~</span>
          <span class="terminal-spacer"></span>
          <a class="terminal-exit" href="/home" title="close">&#10005;</a>
        </div>
        <div class="terminal-screen" id="term-output"></div>
        <div class="terminal-line">
          <span class="terminal-prompt">guest@nest:~$</span>
          <input class="terminal-input" id="term-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="terminal input" />
        </div>
      </div>`;

    this.container = container;
    this.output = container.querySelector("#term-output");
    this.input = container.querySelector("#term-input");

    await this.loadFiles();
    this.banner();
    this.bindEvents();
    this.input.focus();
  }

  async loadFiles() {
    const sources = [
      { url: "files.json", kind: "json" },
      { url: "feed.atom", kind: "atom" },
      { url: "feed.rss", kind: "rss" },
    ];
    for (const src of sources) {
      try {
        const res = await fetch(src.url, { cache: "no-store" });
        if (!res.ok) continue;
        const files = await this.parseSource(res, src.kind);
        if (files.length) {
          this.files = files;
          return;
        }
      } catch {
        // try the next source
      }
    }
    const fallback = this.config.terminalFiles;
    if (Array.isArray(fallback)) {
      this.files = fallback.map((f) =>
        typeof f === "string" ? { slug: f, title: f } : f,
      );
    }
  }

  async parseSource(res, kind) {
    if (kind === "json") {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.filter((f) => f && f.slug);
      }
      return [];
    }
    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const entries =
      kind === "atom" ? doc.querySelectorAll("entry") : doc.querySelectorAll("item");
    const files = [];
    entries.forEach((e) => {
      let link = null;
      if (kind === "atom") {
        link = e.querySelector("link")?.getAttribute("href");
      } else {
        const node = e.querySelector("link");
        if (node) link = node.textContent;
      }
      const m = (link || "").match(/#\/([^#/]+)/);
      if (m) {
        files.push({
          slug: m[1],
          title: e.querySelector("title")?.textContent?.trim() || m[1],
        });
      }
    });
    return files;
  }

  banner() {
    this.renderBanner([
      `<span class="term-acc">~ robin&apos;s nest ~</span>`,
      `<span class="term-dim">you are standing in a very cozy nest.</span>`,
      `<span class="term-dim">everything here is a file,</span>`,
      `<span class="term-dim">and every file is a little page.</span>`,
      ``,
      `type <span class="term-acc">ls</span> to peek around, or`,
      `<span class="term-acc">help</span> for available commands.`,
    ]);
  }

  renderBanner(info) {
    const art = [
      ["tb", '        _.-"\\'],
      ["tb", '    _.-"     \\'],
      ["tp", ' ,-"          \\'],
      ["tp", "( \\            \\"],
      ["tw", ' \\ \\            \\'],
      ["tw", '  \\ \\            \\'],
      ["tw", '   \\ \\         _.-;'],
      ["tp", '    \\ \\    _.-"   :'],
      ["tp", '     \\ \\,-"    _.-"'],
      ["tb", '      \\(   _.-"'],
      ["tb", '       \\`--"'],
    ];
    const left = art
      .map(
        ([cls, s]) =>
          `<div class="term-art term-${cls}">${escapeHtml(s)}</div>`,
      )
      .join("");
    const right = info.map((s) => `<div>${s}</div>`).join("");
    this.line(
      `<div class="banner-grid"><div class="banner-art">${left}</div><div class="banner-info">${right}</div></div>`,
    );
    this.promptRow();
  }

  cmdHyfetch() {
    const info = [
      `<span class="term-acc">guest@${escapeHtml(window.location.hostname || "nest")}</span>`,
      `<span class="term-dim">${"-".repeat(15)}</span>`,
      `<span class="term-dim">OS:</span> <span class="term-acc">${escapeHtml(this.osName())}</span>`,
      `<span class="term-dim">Host:</span> <span class="term-file">robin&apos;s nest</span>`,
      `<span class="term-dim">Kernel:</span> <span class="term-dim">${escapeHtml(this.kernel())}</span>`,
      `<span class="term-dim">Uptime:</span> <span class="term-acc">${this.uptime()}</span>`,
      `<span class="term-dim">Pages:</span> <span class="term-acc">${this.files.length}</span>`,
      `<span class="term-dim">Shell:</span> zsh`,
      `<span class="term-dim">Terminal:</span> markdownium-term`,
      `<span class="term-dim">Resolution:</span> ${escapeHtml(window.innerWidth + "x" + window.innerHeight)}`,
      `<span class="term-dim">Theme:</span> <span class="term-acc">vague</span>`,
    ];
    this.renderBanner(info);
  }

  osName() {
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
    if (/mac os x|macintosh/i.test(ua)) return "macOS";
    if (/windows/i.test(ua)) return "Windows";
    if (/android/i.test(ua)) return "Android";
    if (/cros/i.test(ua)) return "ChromeOS";
    if (/freebsd/i.test(ua)) return "FreeBSD";
    if (/linux/i.test(ua)) return "Linux";
    return "NestOS";
  }

  kernel() {
    const m = navigator.userAgent.match(/([a-z]+) like Mac OS X|Windows NT ([0-9.]+)|Linux[^;)]*/i);
    return m ? m[0] : navigator.platform || "unknown";
  }

  uptime() {
    if (!this._boot) this._boot = Date.now();
    const s = Math.max(0, Math.floor((Date.now() - this._boot) / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  bindEvents() {
    this.input.addEventListener("keydown", (e) => this.onKeydown(e));
    this.container.addEventListener("click", (e) => {
      if (e.target !== this.input) this.input.focus();
    });
  }

  onKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const raw = this.input.value;
      this.history.push(raw);
      this.historyIndex = this.history.length;
      this.resetTab();
      this.input.value = "";
      this.echo(raw);
      this.exec(raw);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.historyUp();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this.historyDown();
    } else if (e.key === "Tab") {
      e.preventDefault();
      this.complete();
    } else if (e.key === "Escape") {
      this.input.value = "";
      this.resetTab();
    } else {
      this.resetTab();
    }
  }

  echo(raw) {
    this.line(`<span class="term-prompt"></span>${escapeHtml(raw)}`);
  }

  exec(raw) {
    const tokens = raw.trim().split(/\s+/);
    const [cmd, ...args] = tokens;
    const c = (cmd || "").toLowerCase();
    switch (c) {
      case "":
        break;
      case "hyfetch":
      case "fastfetch":
      case "neofetch":
        this.cmdHyfetch();
        break;
      case "help":
      case "?":
        this.cmdHelp();
        break;
      case "ls":
      case "dir":
        this.cmdLs(args);
        break;
      case "ll":
      case "ls-l":
        this.cmdLs(["-l"]);
        break;
      case "cat":
      case "open":
      case "view":
      case "nano":
      case "vim":
        this.cmdCat(args);
        break;
      case "clear":
        this.clear();
        break;
      case "pwd":
        this.line(escapeHtml(this.pwd()));
        break;
      case "whoami":
        this.line("guest");
        break;
      case "echo":
        this.line(escapeHtml(args.join(" ")));
        break;
      case "date":
        this.line(escapeHtml(new Date().toString()));
        break;
      case "history":
        this.cmdHistory();
        break;
      case "cd":
        this.cmdCd(args);
        break;
      case "sudo":
        this.line("nice try. you already hold all the power here.");
        break;
      case "exit":
        this.line("there is no leaving the nest.");
        break;
      case "ni":
      case "npm":
      case "yarn":
      case "pnpm":
      case "bun":
        this.line("there is nothing to install. you are already home.");
        break;
      default:
        this.line(
          `<span class="term-err">${escapeHtml(cmd)}: command not found</span> ` +
            `<span class="term-dim">&mdash; try</span> <span class="term-acc">help</span>`,
        );
    }
  }

  cmdHelp() {
    const rows = [
      ["ls", "list the files in the nest"],
      ["cat <file>", "open a file (takes you to the page)"],
      ["open <file>", "alias of cat"],
      ["hyfetch", "system info, pride edition"],
      ["clear", "clear the screen"],
      ["pwd", "print working directory"],
      ["whoami", "who you are"],
      ["echo <text>", "echo text back"],
      ["date", "current date and time"],
      ["cd <dir>", "wander (there is nowhere to go)"],
      ["sudo", "try it"],
      ["exit", "try to leave (you cannot)"],
    ];
    rows.forEach(([name, desc]) => {
      this.line(
        `<span class="term-acc">${escapeHtml(name.padEnd(14))}</span>` +
          `<span class="term-dim">${escapeHtml(desc)}</span>`,
      );
    });
  }

  cmdLs(args) {
    const long = args.some((a) => a.startsWith("-"));
    if (!this.files.length) {
      this.line(
        `total 0 <span class="term-dim">&mdash; the nest is empty (run 'build:feeds' to refresh the file index)</span>`,
      );
      return;
    }
    if (long) {
      this.line(`total ${this.files.length}`);
      this.files.forEach((f) => {
        this.line(
          `-rw-r--r-- 1 guest nest ~` +
            `<span class="term-file"> ${escapeHtml(f.slug)}.md</span>` +
            ` &mdash; <span class="term-dim">${escapeHtml(f.title)}</span>`,
        );
      });
      return;
    }
    this.line(
      this.files
        .map((f) => `<span class="term-file">${escapeHtml(f.slug)}.md</span>`)
        .join(" &nbsp;&nbsp; "),
    );
  }

  cmdCat(args) {
    const target = args.join(" ").trim().replace(/\.md$/i, "");
    if (!target) {
      this.line(
        `usage: cat &lt;file&gt; <span class="term-dim">(try 'ls' first)</span>`,
      );
      return;
    }
    const found = this.files.find((f) => f.slug === target);
    if (found) {
      this.line(
        `opening <span class="term-acc">${escapeHtml(found.slug)}.md</span> ...`,
      );
      setTimeout(() => this.router.navigate("/" + found.slug), 400);
      return;
    }
    this.line(
      `<span class="term-err">cat: ${escapeHtml(target)}: No such file or directory</span>`,
    );
    const fuzzy = this.files.filter(
      (f) => f.slug.includes(target) || target.includes(f.slug),
    );
    if (fuzzy.length) {
      this.line(
        `<span class="term-dim">did you mean:</span> ` +
          fuzzy
            .map((f) => `<span class="term-file">${escapeHtml(f.slug)}</span>`)
            .join(", "),
      );
    }
  }

  cmdCd(args) {
    const dir = (args[0] || "").toLowerCase().replace(/\/+$/, "");
    if (!dir || dir === "~" || dir === "/~robin") {
      this.line("you are already in the nest.");
    } else {
      this.line(
        `<span class="term-err">cd: ${escapeHtml(args[0])}: No such file or directory</span> ` +
          `<span class="term-dim">&mdash; the nest has no subdirectories, only thoughts</span>`,
      );
    }
  }

  cmdHistory() {
    const seen = this.history.filter((h) => h.trim());
    if (!seen.length) {
      this.line("history is empty. type something!");
      return;
    }
    seen.forEach((h, i) => {
      this.line(`${i + 1}  ${escapeHtml(h)}`);
    });
  }

  clear() {
    this.output.innerHTML = "";
  }

  historyUp() {
    if (!this.history.length) return;
    if (this.historyIndex === -1 || this.historyIndex > this.history.length - 1) {
      this.historyIndex = this.history.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex--;
    }
    this.input.value = this.history[this.historyIndex];
    this.resetTab();
  }

  historyDown() {
    if (!this.history.length || this.historyIndex === -1) return;
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.input.value = this.history[this.historyIndex];
    } else {
      this.historyIndex = -1;
      this.input.value = "";
    }
    this.resetTab();
  }

  resetTab() {
    this.tabMatches = [];
    this.tabIndex = 0;
    this.tabBase = "";
  }

  complete() {
    const tokens = this.input.value.split(/\s+/);
    const isFileCmd = ["cat", "open", "view", "nano", "vim"].includes(
      (tokens[0] || "").toLowerCase(),
    );
    if (!isFileCmd || tokens.length < 2) return;
    const prefix = tokens[tokens.length - 1].toLowerCase().replace(/\.md$/i, "");

    const matches = this.files.filter(
      (f) =>
        f.slug.toLowerCase().startsWith(prefix) ||
        (prefix.length > 1 && f.slug.toLowerCase().includes(prefix)),
    );
    if (!matches.length) return;

    if (this.tabBase !== prefix) {
      this.tabBase = prefix;
      this.tabMatches = matches.map((f) => f.slug);
      this.tabIndex = 0;
      if (matches.length > 1) {
        this.line(
          matches
            .map((f) => `<span class="term-file">${escapeHtml(f.slug)}.md</span>`)
            .join(" "),
        );
      }
    } else {
      this.tabIndex = (this.tabIndex + 1) % Math.max(1, this.tabMatches.length);
    }

    const chosen = this.tabMatches[this.tabIndex];
    tokens[tokens.length - 1] = chosen;
    this.input.value =
      tokens.join(" ") + (this.tabMatches.length === 1 ? " " : "");
  }

  promptRow() {
    this.line(`<span class="term-prompt"></span>`);
  }

  line(html) {
    const el = document.createElement("div");
    el.className = "term-line";
    el.innerHTML = html;
    this.output.appendChild(el);
    this.output.scrollTop = this.output.scrollHeight;
  }

  pwd() {
    const path = window.location.pathname.replace(/\/$/, "");
    return path || "/~robin";
  }
}
