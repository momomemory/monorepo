// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
	integrations: [
		// ⚠️ mermaid must come BEFORE starlight
		mermaid({
			autoTheme: true,
			theme: 'neutral',
			enableLog: false,
		}),
		starlight({
			title: 'momo',
			description: 'Documentation for Momo, the self-hostable AI memory system.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/momomemory/momo' }],
			customCss: ['./src/styles/custom.css'],
			defaultLocale: 'root',
			components: {
				Head: './src/components/Head.astro',
				ThemeSelect: './src/components/ThemeSelect.astro',
			},
			expressiveCode: {
				themes: ['min-dark', 'min-light'],
				styleOverrides: {
					codeFontFamily: "'IBM Plex Mono', 'Menlo', 'Consolas', monospace",
					codeFontSize: '0.8125rem',
					borderRadius: '4px',
					borderColor: 'var(--sl-color-hairline)',
					frames: {
						shadowColor: 'transparent',
					},
				},
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
				label: 'Agent Plugins',
				items: [
					{ label: 'Overview', slug: 'guides/plugins' },
					{ label: 'OpenCode', slug: 'guides/plugins/opencode' },
					{ label: 'OpenClaw', slug: 'guides/plugins/openclaw' },
					{ label: 'Pi', slug: 'guides/plugins/pi' },
				],
			},
			{
				label: 'SDKs',
				items: [
					{ label: 'Overview', slug: 'sdks' },
					{ label: 'TypeScript', slug: 'sdks/typescript' },
					{ label: 'Python', slug: 'sdks/python' },
				],
			},
			{
				label: 'Reference',
					items: [
						{ label: 'API Reference', slug: 'reference/api' },
						{ label: 'Embedded C FFI', slug: 'reference/ffi' },
						{ label: 'Configuration', slug: 'reference/configuration' },
					],
				},
				{
					label: 'Project',
					items: [{ label: 'Release Strategy', slug: 'project/release-strategy' }],
				},
			],
		}),
	],
});
