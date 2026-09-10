import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, extname, basename, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CONTENT_DIR = join(__dirname, "content");
const OUT_DIR = __dirname;

let config = {};
try {
  config = JSON.parse(readFileSync(join(__dirname, "config.json"), "utf-8"));
} catch {
  config = { siteName: "Robin's Nest", baseUrl: "" };
}

const siteUrl = (config.baseUrl || "").replace(/\/content\/?$/, "").replace(/\/$/, "");
const feedUrl = `${siteUrl}/feed.rss`;
const atomUrl = `${siteUrl}/feed.atom`;

const PAGE_EXCLUDED_FILES = new Set(["sidebar.md", "top.md", "gallery-intro.md"]);

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getMarkdownFiles() {
  try {
    const entries = readdirSync(CONTENT_DIR);
    return entries
      .filter((f) => extname(f) === ".md" && !PAGE_EXCLUDED_FILES.has(f))
      .map((f) => {
        const fullPath = join(CONTENT_DIR, f);
        const stats = statSync(fullPath);
        const content = readFileSync(fullPath, "utf-8");
        const titleMatch = content.match(/^#{1,6}\s+(.+)$/m);
        return {
          slug: basename(f, ".md"),
          title: titleMatch ? titleMatch[1].trim() : basename(f, ".md"),
          pubDate: stats.mtime,
          description: content.slice(0, 200).replace(/[#*_`]/g, "").trim(),
        };
      })
      .sort((a, b) => b.pubDate - a.pubDate);
  } catch {
    return [];
  }
}

function buildRss(items) {
  const now = new Date().toUTCString();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.siteName)}</title>
    <link>${escapeXml(siteUrl || "/")}</link>
    <description>${escapeXml(config.siteName)}</description>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
`;
  for (const item of items) {
    xml += `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(`${siteUrl}/#/${item.slug}`)}</link>
      <guid isPermaLink="true">${escapeXml(`${siteUrl}/#/${item.slug}`)}</guid>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>
`;
  }
  xml += `  </channel>
</rss>`;
  return xml;
}

function buildAtom(items) {
  const now = new Date().toISOString();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(config.siteName)}</title>
  <link href="${escapeXml(siteUrl || "/")}" />
  <link href="${escapeXml(atomUrl)}" rel="self" />
  <updated>${now}</updated>
  <id>${escapeXml(siteUrl || "/")}</id>
`;
  for (const item of items) {
    xml += `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(`${siteUrl}/#/${item.slug}`)}" />
    <id>${escapeXml(`${siteUrl}/#/${item.slug}`)}</id>
    <updated>${item.pubDate.toISOString()}</updated>
    <summary>${escapeXml(item.description)}</summary>
  </entry>
`;
  }
  xml += `</feed>`;
  return xml;
}

function scanImages(imagesDir) {
  const IMAGE_EXTS = new Set([
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".bmp",
  ]);
  try {
    return readdirSync(imagesDir)
      .filter((f) => {
        const ext = extname(f).toLowerCase();
        return IMAGE_EXTS.has(ext) && !f.startsWith(".");
      })
      .map((f) => {
        const stats = statSync(join(imagesDir, f));
        return { name: f, src: `content/images/${f}`, mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

function buildGalleryManifest(outFile, imagesDir) {
  const images = scanImages(imagesDir);
  writeFileSync(outFile, JSON.stringify({ images }, null, 2) + "\n");
  return images;
}

function readJson(file) {
  try {
    if (!existsSync(file)) return null;
    const data = JSON.parse(readFileSync(file, "utf-8"));
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

function buildActivity(outFile, contentDir) {
  const prev = readJson(outFile) || {};
  const days = { ...(prev.days && typeof prev.days === "object" ? prev.days : {}) };
  const files = { ...(prev.files && typeof prev.files === "object" ? prev.files : {}) };

  const add = (key) => { days[key] = (days[key] || 0) + 1; };
  const localKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const seen = new Set();
  const walk = (dir) => {
    let names = [];
    try { names = readdirSync(dir); } catch { return; }
    for (const name of names) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      try {
        const stats = statSync(full);
        if (stats.isDirectory()) {
          walk(full);
        } else {
          const rel = join("content", relative(CONTENT_DIR, full));
          seen.add(rel);
          const m = stats.mtime;
          const ms = m.getTime();
          const key = localKey(m);
          const prevFile = files[rel];
          if (!prevFile) {
            add(key);
            files[rel] = { m: ms, d: key };
          } else if (ms > prevFile.m) {
            add(key);
            files[rel] = { m: ms, d: key };
          }
        }
      } catch { /* file vanished mid-scan */ }
    }
  };
  walk(contentDir);

  for (const rel of Object.keys(files)) {
    if (!seen.has(rel)) delete files[rel];
  }

  const data = { days, files, updated: new Date().toISOString(), sources: ["mtime"] };
  writeFileSync(outFile, JSON.stringify(data, null, 2) + "\n");
  return data;
}

const items = getMarkdownFiles();

writeFileSync(join(OUT_DIR, "feed.rss"), buildRss(items));
writeFileSync(join(OUT_DIR, "feed.atom"), buildAtom(items));

const pages = readdirSync(CONTENT_DIR)
  .filter((f) => extname(f) === ".md" && !PAGE_EXCLUDED_FILES.has(f))
  .map((f) => {
    const content = readFileSync(join(CONTENT_DIR, f), "utf-8");
    const titleMatch = content.match(/^#{1,6}\s+(.+)$/m);
    return { slug: basename(f, ".md"), title: titleMatch ? titleMatch[1].trim() : basename(f, ".md") };
  });
writeFileSync(join(OUT_DIR, "files.json"), JSON.stringify(pages, null, 2) + "\n");

const galleryImages = buildGalleryManifest(join(OUT_DIR, "gallery.json"), join(CONTENT_DIR, "images"));

const activity = buildActivity(join(OUT_DIR, "activity.json"), CONTENT_DIR);

console.log(`Wrote feed.rss (${items.length} items) and feed.atom`);
console.log(`Wrote files.json (${pages.length} pages)`);
console.log(`Wrote gallery.json (${galleryImages.length} images)`);
console.log(`Wrote activity.json (${Object.keys(activity.days).length} active days)`);
console.log(`RSS: ${feedUrl}`);
console.log(`Atom: ${atomUrl}`);
