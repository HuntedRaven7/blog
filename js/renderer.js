import { Marked } from "./external/marked.esm.js";
import { markedHighlight } from "./external/marked-highlight.esm.js";
import hljs from "./external/highlight.js";
export function enhanceCodeBlocks(root) {
  const pres = (root || document).querySelectorAll("pre");
  pres.forEach((pre) => {
    if (pre.querySelector(".code-copy")) return;
    const code = pre.querySelector("code");
    if (!code) return;
    pre.classList.add("has-copy");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.title = "Copy code";
    btn.textContent = "copy";
    btn.addEventListener("click", async () => {
      const text = code.innerText;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          throw new Error("clipboard unavailable");
        }
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText =
          "position: fixed; top: 0; left: 0; opacity: 0; pointer-events: none;";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch {
          /* give up */
        }
        ta.remove();
      }
      btn.classList.add("copied");
      btn.textContent = "copied!";
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.textContent = "copy";
      }, 1400);
    });
    pre.appendChild(btn);
  });
}

export class Renderer {
  constructor(config) {
    this.config = config;
    this.hljs = null;
    this.marked = null;
    this.setupMarked();
    this.initHighlightJS();
  }

  async initHighlightJS() {
    try {
      const highlightJs = await import("./external/highlight.js");
      console.log(
        highlightJs.default.highlight("console.log('h');", { language: "js" })
          .value,
      );
      this.hljs = highlightJs.default;
      this.setupMarked();
    } catch (error) {
      console.warn("Failed to load highlight.js");
    }
  }

  setupMarked() {
    this.marked = new Marked(
      markedHighlight({
        emptyLangClass: "hljs",
        langPrefix: "hljs language-",
        highlight(code, lang, info) {
          const language = hljs.getLanguage(lang) ? lang : "plaintext";
          return hljs.highlight(code, { language }).value;
        },
      }),
    );
    this.marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }

  render(markdown, page = "") {
    let processedMarkdown = markdown.replaceAll("%GAP%", "&nbsp;&nbsp;&nbsp;");
    const html = this.marked.parse(processedMarkdown);
    const withVideos = this.buildPlaylist(html);
    const processedHtml = withVideos.replace(
      /<h([1-6])>(.*?)<\/h\1>/g,
      (match, level, content) => {
        const id = content
          .toLowerCase()
          .replace(/<[^>]*>/g, "")
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");
        if (page === "home") {
          return `<h${level} id="${id}">${content}</h${level}>`;
        }
        return `<h${level} id="${id}" style="cursor: pointer;" onclick="const currentPath = window.location.hash || '#/home'; const pagePart = currentPath.split('#')[0] || '#/home'; window.location.hash = pagePart + '#${id}'">${content}</h${level}>`;
      },
    );

    return DOMPurify.sanitize(processedHtml, {
      ADD_TAGS: ["iframe", "video", "audio"],
      ADD_ATTR: [
        "allow",
        "allowfullscreen",
        "frameborder",
        "scrolling",
        "src",
        "title",
        "loading",
        "referrerpolicy",
        "id",
        "onclick",
        "style",
      ],
    });
  }

  buildPlaylist(html) {
    const patterns = [
      /youtube\.com\/watch\?.*\bv=([A-Za-z0-9_-]{6,20})/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/,
      /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,20})/,
      /youtu\.be\/([A-Za-z0-9_-]{6,20})/,
    ];
    let idx = 0;

    return html.replace(
      /<a href="([^"]+)"[^>]*>(.*?)<\/a>/gs,
      (match, href, inner) => {
        for (const p of patterns) {
          const m = href.match(p);
          if (!m) continue;
          idx++;
          const text = inner.replace(/<[^>]*>/g, "").trim();
          const display = text && text !== href ? text : m[1];
          return (
            `<a href="${href}" target="_blank" rel="noopener noreferrer" ` +
            `class="playlist-item" data-video-id="${m[1]}" ` +
            `title="open on youtube">` +
            `<span class="playlist-idx">${idx}</span>` +
            `<span class="playlist-thumb">` +
            `<img src="https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg" alt="" loading="lazy" />` +
            `</span>` +
            `<span class="playlist-main">` +
            `<span class="playlist-title">${display}</span>` +
            `<span class="playlist-duration">--:--</span>` +
            `</span>` +
            `<span class="playlist-domain">youtube</span>` +
            `</a>`
          );
        }
        return match;
      },
    );
  }
}
