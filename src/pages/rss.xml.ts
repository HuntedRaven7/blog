import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

const CONTENT_BASE = 'https://files.obsidianos.xyz/~robin/blog/content';

async function fetchText(url: string): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
	return res.text();
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

function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export async function GET() {
	const EXCLUDED = new Set(['home', 'sidebar', 'top', 'gallery-intro', 'graph']);
	try {
		const indexHtml = await fetchText(CONTENT_BASE);
		const files = extractMarkdownFiles(indexHtml)
			.filter((f) => !EXCLUDED.has(f.replace('.md', '')));

		const items = await Promise.all(
			files.map(async (f) => {
				const slug = f.replace('.md', '');
				const content = await fetchText(`${CONTENT_BASE}/${f}`);
				const titleMatch = content.match(/^#\s+(.+)$/m);
				const title = titleMatch ? titleMatch[1].trim() : slug;
				const description = content.slice(0, 200).replace(/[#*_`]/g, '').trim();
				return {
					title,
					description,
					link: `https://robin.tarxz.zip/blog/${slug}`,
					pubDate: new Date().toISOString(),
				};
			})
		);

		const now = new Date().toUTCString();
		let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>https://robin.tarxz.zip</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="https://robin.tarxz.zip/blog/rss.xml" rel="self" type="application/rss+xml" />
`;

		for (const item of items) {
			xml += `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>
`;
		}

		xml += `  </channel>
</rss>`;

		return new Response(xml, {
			headers: {
				'Content-Type': 'application/rss+xml',
			},
		});
	} catch (e) {
		console.error('Failed to generate RSS:', e);
		return new Response('Failed to generate RSS', { status: 500 });
	}
}
