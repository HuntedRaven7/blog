import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, extname, basename } from "path";
import { fileURLToPath } from "url";
import { buildGalleryManifest } from "./gallery-builder.js";
import { buildActivity } from "./generate-activity.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CONTENT_DIR = join(__dirname, "content");
const OUT_DIR = __dirname;

let config = {};
try {
  const raw = readFileSync(join(__dirname, "config.json"), "utf-8");
  config = JSON.parse(raw);
} catch {
  config = { siteName: "Robin's Nest", baseUrl: "" };
}

const siteUrl = (config.baseUrl || "").replace(/\/content\/?$/, "").replace(/\/$/, "");
const feedUrl = `${siteUrl}/feed.rss`;
const atomUrl = `${siteUrl}/feed.atom`;

const EXCLUDED_FILES = new Set(["sidebar.md", "top.md", "home.md", "gallery-intro.md"]);
const PAGE_EXCLUDED_FILES = new Set(["sidebar.md", "top.md", "gallery-intro.md"]);

function getMarkdownFiles() {
  try {
    const entries = readdirSync(CONTENT_DIR);
    const files = entries
      .filter((f) => extname(f) === ".md" && !EXCLUDED_FILES.has(f))
      .map((f) => {
        const fullPath = join(CONTENT_DIR, f);
        const stats = statSync(fullPath);
        const content = readFileSync(fullPath, "utf-8");
        const titleMatch = content.match(/^#{1,6}\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : basename(f, ".md");
        const slug = basename(f, ".md");
        return {
          slug,
          title,
          pubDate: stats.mtime,
          description: content.slice(0, 200).replace(/[#*_`]/g, "").trim(),
        };
      });
    files.sort((a, b) => b.pubDate - a.pubDate);
    return files;
  } catch {
    return [];
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(date) {
  return date.toUTCString();
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
      <pubDate>${toRfc822(item.pubDate)}</pubDate>
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

const items = getMarkdownFiles();

writeFileSync(join(OUT_DIR, "feed.rss"), buildRss(items));
writeFileSync(join(OUT_DIR, "feed.atom"), buildAtom(items));

const pages = readdirSync(CONTENT_DIR)
  .filter((f) => extname(f) === ".md" && !PAGE_EXCLUDED_FILES.has(f))
  .map((f) => {
    const content = readFileSync(join(CONTENT_DIR, f), "utf-8");
    const titleMatch = content.match(/^#{1,6}\s+(.+)$/m);
    const slug = basename(f, ".md");
    return {
      slug,
      title: titleMatch ? titleMatch[1].trim() : slug,
    };
  });

writeFileSync(join(OUT_DIR, "files.json"), JSON.stringify(pages, null, 2) + "\n");

const galleryImages = buildGalleryManifest(
  join(OUT_DIR, "gallery.json"),
  join(CONTENT_DIR, "images"),
);

const activity = buildActivity(
  join(OUT_DIR, "activity.json"),
  CONTENT_DIR,
);

console.log(`Wrote feed.rss (${items.length} items) and feed.atom to ${OUT_DIR}`);
console.log(`Wrote files.json (${pages.length} pages) to ${OUT_DIR}`);
console.log(`Wrote gallery.json (${galleryImages.length} images) to ${OUT_DIR}`);
console.log(
  `Wrote activity.json (${Object.keys(activity.days).length} active days) to ${OUT_DIR}`,
);
console.log(`RSS: ${feedUrl}`);
console.log(`Atom: ${atomUrl}`);
