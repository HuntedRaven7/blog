export function processMarkdown(markdown: string): string {
	let processed = markdown.replaceAll('%GAP%', '&nbsp;&nbsp;&nbsp;');
	return processed;
}

export function extractTitle(markdown: string): string {
	const match = markdown.match(/^#{1,6}\s+(.+)$/m);
	return match ? match[1].trim() : '';
}

export function renderSidebarMarkdown(markdown: string, basePath = '/blog'): string {
	const rawHtml = renderMarkdownToHtml(markdown, basePath);
	return rawHtml.replace(
		/<a /g,
		`<a class="link nav-link" `
	);
}

export function renderMarkdownToHtml(markdown: string, basePath = '/blog'): string {
	const lines = markdown.split('\n');
	const htmlLines: string[] = [];
	let inCodeBlock = false;
	let codeBlockLang = '';
	let codeLines: string[] = [];

	for (const line of lines) {
		if (line.startsWith('```')) {
			if (!inCodeBlock) {
				inCodeBlock = true;
				codeBlockLang = line.slice(3).trim();
				codeLines = [];
				continue;
			} else {
				inCodeBlock = false;
				const codeContent = codeLines.join('\n');
				const escaped = codeContent
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;');
				htmlLines.push(`<pre><code class="language-${codeBlockLang}">${escaped}</code></pre>`);
				continue;
			}
		}

		if (inCodeBlock) {
			codeLines.push(line);
			continue;
		}

		const processedLine = processMarkdown(line);
		htmlLines.push(processedLine);
	}

	const rawHtml = htmlLines.join('\n');
	return basicMarkdownToHtml(rawHtml, basePath);
}

function basicMarkdownToHtml(text: string, basePath = '/blog'): string {
	let html = text;

	html = html.replace(/```[\s\S]*?```/g, (match) => {
		const langMatch = match.match(/^```(\w*)/);
		const lang = langMatch ? langMatch[1] : '';
		const code = match.slice(3, -3).replace(/^(\w+)?\n/, '');
		const escaped = code
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
		return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
	});

	html = html.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>');
	html = html.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>');
	html = html.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>');
	html = html.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>');
	html = html.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>');
	html = html.replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>');

	html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
		if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#') || href.startsWith('/blog/')) {
			return `<a href="${href}">${text}</a>`;
		}
		if (href.startsWith('/')) {
			const cleaned = href.replace(/^\/+/, '');
			const slug = cleaned === 'home' ? '' : cleaned;
			return `<a href="${basePath}/${slug}">${text}</a>`;
		}
		return `<a href="${basePath}/${href}">${text}</a>`;
	});

	html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
	html = html.replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`);

	html = html.replace(/^\s*>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
	html = html.replace(/(<blockquote>.*<\/blockquote>\n?)+/gs, (match) => `<blockquote>${match.replace(/<\/blockquote>\n<blockquote>/g, '<br>')}</blockquote>`);

	html = html.replace(/^(?!<[a-z])((?!<[a-z]).)+$/gm, (match) => {
		if (!match.trim()) return match;
		return `<p>${match}</p>`;
	});

	html = html.replace(/<p><(h[1-6]|ul|pre|blockquote)/g, '<$1');
	html = html.replace(/<\/(h[1-6]|ul|pre|blockquote)><\/p>/g, '</$1>');

	return html;
}
