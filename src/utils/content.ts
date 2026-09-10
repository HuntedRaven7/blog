import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONTENT_DIR = join(process.cwd(), 'content');

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

export async function fetchWithHeaders(url: string): Promise<string> {
	const res = await fetch(url, {
		headers: {
			'User-Agent': USER_AGENT,
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
		},
	});
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
	return res.text();
}

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
