import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'content');

export function getLocalMarkdownFiles(): string[] {
	try {
		if (!existsSync(CONTENT_DIR)) return [];
		return readdirSync(CONTENT_DIR)
			.filter((f) => extname(f) === '.md')
			.map((f) => basename(f, '.md'));
	} catch {
		return [];
	}
}

export function readLocalMarkdown(slug: string): string | null {
	try {
		const path = join(CONTENT_DIR, `${slug}.md`);
		if (!existsSync(path)) return null;
		return readFileSync(path, 'utf-8');
	} catch {
		return null;
	}
}

export function getLocalImageFiles(): string[] {
	try {
		const imagesDir = join(CONTENT_DIR, 'images');
		if (!existsSync(imagesDir)) return [];
		return readdirSync(imagesDir);
	} catch {
		return [];
	}
}
