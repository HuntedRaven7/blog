import { readdirSync, statSync, writeFileSync } from "fs";
import { join, extname } from "path";

export const IMAGE_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".bmp",
]);

export function scanImages(imagesDir) {
  let images = [];
  try {
    images = readdirSync(imagesDir)
      .filter((f) => {
        const ext = extname(f).toLowerCase();
        return IMAGE_EXTS.has(ext) && !f.startsWith(".");
      })
      .map((f) => {
        const stats = statSync(join(imagesDir, f));
        return {
          name: f,
          src: `content/images/${f}`,
          mtime: stats.mtime,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    images = [];
  }
  return images;
}

export function buildGalleryManifest(outFile, imagesDir) {
  const images = scanImages(imagesDir);
  writeFileSync(outFile, JSON.stringify({ images }, null, 2) + "\n");
  return images;
}