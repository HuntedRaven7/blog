import { defineConfig } from 'astro/config';

export default defineConfig({
	site: 'https://robin.tarxz.zip',
	base: '/blog',
	build: {
		format: 'file',
	},
});
