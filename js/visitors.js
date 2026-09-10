const API = "https://countapi.mileshilliard.com/api/v1/hit/robinsnest_guests";
const SESSION_FLAG = "mn:v:session";
const CACHED = "mn:v:cached";
const LOCAL = "mn:v:local";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* private mode etc. */
  }
}

function sessionMarked() {
  try {
    return !!sessionStorage.getItem(SESSION_FLAG);
  } catch {
    return false;
  }
}

function markSession() {
  try {
    sessionStorage.setItem(SESSION_FLAG, "1");
  } catch {
    /* no-op */
  }
}

export function initVisitorWidget(container) {
  if (!container) return;

  const widget = document.createElement("div");
  widget.className = "visitor-widget";
  widget.innerHTML = `
    <span class="visitor-widget-label">nest visitors</span>
    <span class="visitor-widget-count">&middot; &middot; &middot;</span>`;
  container.appendChild(widget);
  const numEl = widget.querySelector(".visitor-widget-count");

  const cached = read(CACHED, 0);
  let local = read(LOCAL, 0);
  const isNewSession = !sessionMarked();

  if (isNewSession) {
    markSession();
    local += 1;
    write(LOCAL, local);
  }

  const base = Math.max(cached, local);
  numEl.textContent = base.toLocaleString();

  if (isNewSession) {
    fetch(API)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((data) => {
        const value = parseInt(data && data.value, 10);
        if (Number.isFinite(value) && value > 0) {
          write(CACHED, value);
          numEl.textContent = value.toLocaleString();
        }
      })
      .catch(() => {
        /* keep showing the local fallback */
      });
  }
}