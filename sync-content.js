import { readdirSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CONTENT_DIR = join(__dirname, "content");
const REMOTE_BASE = "https://files.obsidianos.xyz/~robin/blog/content";

const EXCLUDED = new Set(["graph.md", "sidebar.md", "top.md", "home.md", "gallery-intro.md"]);

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

async function syncContent() {
  if (!existsSync(CONTENT_DIR)) {
    mkdirSync(CONTENT_DIR, { recursive: true });
  }

  const indexHtml = await fetchText(`${REMOTE_BASE}/`);
  const regex = /<a href="([^"]+\.md)"/g;
  const files = [];
  let match;
  while ((match = regex.exec(indexHtml)) !== null) {
    const href = match[1];
    const name = href.split("/").pop() || href;
    if (name.endsWith(".md")) {
      files.push(name);
    }
  }

  for (const file of files) {
    if (EXCLUDED.has(file)) continue;
    const content = await fetchText(`${REMOTE_BASE}/${file}`);
    writeFileSync(join(CONTENT_DIR, file), content);
    console.log(`Synced ${file}`);
  }

  console.log(`Synced ${files.length} files to ${CONTENT_DIR}`);
}

syncContent().catch((e) => {
  console.error("Failed to sync content:", e);
  process.exit(1);
});
