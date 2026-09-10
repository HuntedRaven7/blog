const VIEWS_KEY = "mn:views";
const COUNTED_KEY = "mn:views:session";

function getStore() {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function countedPages() {
  try {
    const raw = sessionStorage.getItem(COUNTED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function markCounted(slug) {
  const list = countedPages();
  list.push(slug);
  try {
    sessionStorage.setItem(COUNTED_KEY, JSON.stringify(list));
  } catch {
    /* private mode etc. */
  }
}

export function trackView(slug) {
  if (countedPages().includes(slug)) return getViews(slug);

  markCounted(slug);
  const data = getStore();
  data[slug] = (parseInt(data[slug], 10) || 0) + 1;
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(data));
  } catch {
    /* private mode etc. */
  }
  return data[slug];
}

export function getViews(slug) {
  return parseInt(getStore()[slug], 10) || 0;
}

export function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export function readingTime(markdown) {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>~]/g, " ")
    .replace(/\[|\]|\(|\)/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatUpdated(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}