import {
  readdirSync,
  statSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "fs";
import { join, relative } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function localKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

export function buildActivity(
  outFile = join(__dirname, "activity.json"),
  contentDir = join(__dirname, "content"),
) {
  const prev = readJson(outFile) || {};
  const days = {
    ...(prev.days && typeof prev.days === "object" ? prev.days : {}),
  };
  const files = {
    ...(prev.files && typeof prev.files === "object" ? prev.files : {}),
  };

  const add = (key) => {
    days[key] = (days[key] || 0) + 1;
  };

  const seen = new Set();
  const walk = (dir) => {
    let names = [];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      try {
        const stats = statSync(full);
        if (stats.isDirectory()) {
          walk(full);
        } else {
          const rel = relative(contentDir, full);
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
      } catch {
        // file vanished mid-scan, ignore
      }
    }
  };
  walk(contentDir);

  for (const rel of Object.keys(files)) {
    if (!seen.has(rel)) delete files[rel];
  }

  const data = {
    days,
    files,
    updated: new Date().toISOString(),
    sources: ["mtime"],
  };
  writeFileSync(outFile, JSON.stringify(data, null, 2) + "\n");
  return data;
}

const isMain =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  const data = buildActivity();
  const entries = Object.entries(data.days);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  console.log(
    `Wrote activity.json (${entries.length} active days, ${total} contributions)`,
  );
}