// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'momo',
			description: 'Documentation for Momo, the self-hostable AI memory system.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/momomemory/momo' }],
			customCss: ['./src/styles/custom.css'],
			defaultLocale: 'root',
			components: {
				ThemeSelect: './src/components/ThemeSelect.astro',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Overview', link: '/docs/' },
						{ label: 'Self-Hosting', slug: 'guides/self-hosting' },
						{ label: 'MCP Guide', slug: 'guides/mcp' },
					],
				},
				{
					label: 'Reference',
					items: [{ label: 'API Reference', slug: 'reference/api' }],
				},
				{
					label: 'Project',
					items: [{ label: 'Release Strategy', slug: 'project/release-strategy' }],
				},
			],
		}),
	],
});
