export interface NoteNode {
	slug: string;
	title: string;
	links: string[];
	excerpt: string;
}

const EXCLUDED = new Set(['home', 'sidebar', 'top', 'gallery-intro', 'graph']);
import { fetchWithHeaders } from './content.ts';

function parseTitle(content: string): string {
	const match = content.match(/^#\s+(.+)$/m);
	return match ? match[1].trim() : '';
}

function parseLinks(content: string): string[] {
	return Array.from(content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g))
		.map((m) => m[2].replace(/^\/+/, '').replace(/\.md$/, ''));
}

function parseExcerpt(content: string): string {
	return content.replace(/[#*_`]/g, '').trim().slice(0, 120);
}

function extractMarkdownFiles(html: string): string[] {
	const regex = /<a href="([^"]+\.md)"/g;
	const files: string[] = [];
	let match;
	while ((match = regex.exec(html)) !== null) {
		const href = match[1];
		const name = href.split('/').pop() || href;
		if (name.endsWith('.md')) {
			files.push(name);
		}
	}
	return files;
}

export async function getNotes(): Promise<NoteNode[]> {
	try {
		const { getLocalMarkdownFiles, readLocalMarkdown } = await import('./content.ts');
		const localFiles = getLocalMarkdownFiles()
			.filter((f) => !EXCLUDED.has(f))
			.map((f) => f.replace('.md', ''));

		if (localFiles.length > 0) {
			return localFiles.map((slug) => {
				const content = readLocalMarkdown(slug) || '';
				const title = parseTitle(content) || slug;
				const links = parseLinks(content);
				const excerpt = parseExcerpt(content);
				return { slug, title, links, excerpt };
			});
		}

		const indexHtml = await fetchText(CONTENT_BASE);
		const files = extractMarkdownFiles(indexHtml)
			.filter((f) => !EXCLUDED.has(f.replace('.md', '')));

		const notes = await Promise.all(
			files.map(async (f) => {
				const slug = f.replace('.md', '');
				const content = await fetchText(`${CONTENT_BASE}/${f}`);
				const title = parseTitle(content) || slug;
				const links = parseLinks(content);
				const excerpt = parseExcerpt(content);
				return { slug, title, links, excerpt };
			})
		);

		return notes;
	} catch (e) {
		console.error('Failed to load notes:', e);
		return [];
	}
}

export function getBacklinks(noteSlug: string, notes: NoteNode[]): NoteNode[] {
	return notes.filter((n) => n.links.includes(noteSlug));
}
