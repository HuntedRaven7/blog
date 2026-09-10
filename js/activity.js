const NS = "http://www.w3.org/2000/svg";

const LEVEL_COLORS = [
  "rgba(255, 255, 255, 0.06)",
  "rgba(126, 152, 232, 0.28)",
  "rgba(126, 152, 232, 0.55)",
  "#7e98e8",
  "#b4d4cf",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function levelFor(count) {
  if (!count) return 0;
  if (count < 3) return 1;
  if (count < 6) return 2;
  if (count < 10) return 3;
  return 4;
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function initActivityWidget(container) {
  if (!container) return;

  const widget = document.createElement("div");
  widget.className = "activity-widget";
  widget.innerHTML = `
    <span class="visitor-widget-label">blog activity</span>
    <span class="activity-summary" data-role="summary">&middot; &middot; &middot;</span>
    <span class="activity-graph" data-role="graph"></span>
    <span class="activity-legend" data-role="legend" hidden></span>`;
  container.appendChild(widget);

  const summaryEl = widget.querySelector('[data-role="summary"]');
  const graphEl = widget.querySelector('[data-role="graph"]');
  const legendEl = widget.querySelector('[data-role="legend"]');

  fetch("./activity.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("activity.json missing");
      return r.json();
    })
    .then((data) => {
      const days = data && data.days && typeof data.days === "object" ? data.days : {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const gridStart = new Date(startOfWeek);
      gridStart.setDate(startOfWeek.getDate() - 52 * 7);

      const cells = [];
      let active = 0;
      for (let col = 0; col < 53; col++) {
        for (let row = 0; row < 7; row++) {
          const date = new Date(gridStart);
          date.setDate(gridStart.getDate() + col * 7 + row);
          const count = days[dayKey(date)] || 0;
          if (count > 0) active++;
          cells.push({ date, count, level: levelFor(count) });
        }
      }

      if (active === 0) {
        summaryEl.textContent = "no activity yet";
        return;
      }

      const sum = cells.reduce((s, c) => s + c.count, 0);
      summaryEl.textContent = `${sum.toLocaleString()} contribution${
        sum === 1 ? "" : "s"
      } in the last year`;
      renderGraph(graphEl, cells);
      renderLegend(legendEl, today);
    })
    .catch(() => {
      summaryEl.textContent = "no activity yet";
    });
}

function renderGraph(el, cells) {
  const cell = 10;
  const gap = 2;
  const step = cell + gap;
  const rows = 7;
  const cols = 53;
  const width = cols * step - gap;
  const height = rows * step - gap;

  let rects = "";
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const col = Math.floor(i / rows);
    const row = i % rows;
    const tip = c.count
      ? `${c.count} contribution${c.count === 1 ? "" : "s"} on ${formatDate(c.date)}`
      : `No contributions on ${formatDate(c.date)}`;
    rects += `<rect class="activity-cell" x="${col * step}" y="${row * step}" width="${cell}" height="${cell}" rx="${gap}" fill="${LEVEL_COLORS[c.level]}"><title>${tip}</title></rect>`;
  }

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "daily blog activity over the last year");
  svg.innerHTML = rects;
  el.appendChild(svg);
}

function renderLegend(el, today) {
  const less = document.createElement("span");
  less.className = "activity-legend-label";
  less.textContent = "less";

  const more = document.createElement("span");
  more.className = "activity-legend-label";
  more.textContent = "more";

  el.hidden = false;
  el.appendChild(less);
  for (const color of LEVEL_COLORS) {
    const swatch = document.createElement("span");
    swatch.className = "activity-swatch";
    swatch.style.background = color;
    el.appendChild(swatch);
  }
  el.appendChild(more);
}