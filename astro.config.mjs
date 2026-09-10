import { defineConfig } from 'astro/config';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
	site: isGitHubPages ? 'https://huntedraven7.github.io' : 'https://robin.tarxz.zip',
	base: isGitHubPages ? '/Blog' : '/blog',
	build: {
		format: 'file',
	},
});
