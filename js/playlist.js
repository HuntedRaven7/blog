let apiPromise = null;
const durCache = new Map();

function loadIframeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => reject(new Error("failed to load youtube iframe api"));
    document.body.appendChild(s);
  });
  return apiPromise;
}

function fmtDuration(sec) {
  if (!sec || sec <= 0 || !isFinite(sec)) return "--:--";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fill(el, sec) {
  if (!el) return;
  el.textContent = typeof sec === "number" ? fmtDuration(sec) : "--:--";
}

function pollDuration(player, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const d = player.getDuration();
      if (d && d > 0) return resolve(d);
      if (Date.now() - start > timeout) return reject();
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function processRows(YT, work) {
  const tray = document.createElement("div");
  tray.style.cssText =
    "position: fixed; visibility: hidden; pointer-events: none; left: -10000px; top: -10000px; width: 320px; height: 180px;";
  document.body.appendChild(tray);

  for (const { id, durEl } of work) {
    const cached = durCache.get(id);
    if (cached !== undefined) {
      fill(durEl, cached);
      continue;
    }
    await new Promise((resolve) => {
      const cell = document.createElement("div");
      tray.appendChild(cell);
      let player = null;
      let settled = false;
      const done = (sec) => {
        if (settled) return;
        settled = true;
        if (typeof sec === "number") durCache.set(id, sec);
        fill(durEl, sec);
        try {
          if (player) player.destroy();
        } catch {
          /* already gone */
        }
        cell.remove();
        resolve();
      };
      try {
        player = new YT.Player(cell, {
          videoId: id,
          playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
          events: {
            onReady: (e) => {
              pollDuration(e.target, 9000).then(done).catch(() => done(null));
            },
            onError: () => done(null),
          },
        });
      } catch {
        done(null);
      }
    });
    await new Promise((r) => setTimeout(r, 120));
  }
  tray.remove();
}

function buildNowPlaying(YT, rows) {
  const host = rows[0].closest("ul");
  if (!host) return;

  const widget = document.createElement("div");
  widget.className = "now-playing";
  widget.innerHTML = `
    <div class="now-playing-head">
      <span class="now-playing-eyebrow">now playing</span>
      <span class="now-playing-title-wrap">
        <span class="now-playing-title"></span>
      </span>
      <a class="now-playing-open" target="_blank" rel="noopener noreferrer" title="open on youtube">open on youtube ↗</a>
    </div>
    <div class="now-playing-stage">
      <div class="now-playing-frame"></div>
    </div>`;
  host.parentNode.insertBefore(widget, host);

  const titleEl = widget.querySelector(".now-playing-title");
  const linkEl = widget.querySelector(".now-playing-open");
  const stageEl = widget.querySelector(".now-playing-stage");
  const frameEl = widget.querySelector(".now-playing-frame");

  const rowTitle = (row) =>
    (row.querySelector(".playlist-title")?.textContent || "").trim() ||
    row.getAttribute("data-video-id");

  let player = null;

  const pick = (row) => {
    const id = row.getAttribute("data-video-id");
    titleEl.textContent = rowTitle(row);
    linkEl.setAttribute("href", row.getAttribute("href"));
    rows.forEach((r) => r.classList.toggle("playing", r === row));
    if (player && player.loadVideoById) player.loadVideoById(id);
  };

  rows.forEach((row) => {
    row.addEventListener("click", (e) => {
      e.preventDefault();
      pick(row);
    });
  });

  try {
    player = new YT.Player(frameEl, {
      videoId: rows[0].getAttribute("data-video-id"),
      playerVars: { rel: 0, playsinline: 1, autoplay: 1 },
      events: {
        onReady: () => {
          titleEl.textContent = rowTitle(rows[0]);
          linkEl.setAttribute("href", rows[0].getAttribute("href"));
          rows[0].classList.add("playing");
        },
        onError: () => {
          stageEl.classList.add("broken");
        },
      },
    });
  } catch {
    const iframe = document.createElement("iframe");
    iframe.setAttribute(
      "src",
      `https://www.youtube.com/embed/${rows[0].getAttribute("data-video-id")}?rel=0&autoplay=1&playsinline=1`,
    );
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    );
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    frameEl.appendChild(iframe);
    titleEl.textContent = rowTitle(rows[0]);
    linkEl.setAttribute("href", rows[0].getAttribute("href"));
    rows[0].classList.add("playing");
  }
}

export function enhancePlaylist(root) {
  const rows = Array.from(
    (root || document).querySelectorAll("a.playlist-item[data-video-id]"),
  );
  if (!rows.length) return;
  const work = rows.map((row) => ({
    id: row.getAttribute("data-video-id"),
    durEl: row.querySelector(".playlist-duration"),
  }));
  loadIframeApi()
    .then((YT) => {
      try {
        buildNowPlaying(YT, rows);
      } catch {
        /* player is decorative, no worries */
      }
      return processRows(YT, work);
    })
    .catch(() => {});
}