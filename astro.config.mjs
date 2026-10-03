// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	site: 'https://jpl-innovation.github.io',
	// Load pages in the background when a link is hovered so navigation feels instant.
	prefetch: {
		prefetchAll: true,
		defaultStrategy: 'hover',
	},
	// CSS goes inside each page's HTML instead of a separate hashed file. GitHub Pages caches HTML for up to
	// 10 minutes, and every deploy deletes the previous build's CSS file, so a cached page could point at a
	// stylesheet that no longer exists and render unstyled (a "white page"). Inline, a page is always styled;
	// if its old scripts are gone too, the CSS failsafes in SplashShell and BaseLayout still reveal it.
	build: { inlineStylesheets: 'always' },
	integrations: [react()],
	vite: {
		plugins: [tailwindcss()],
		build: {
			// The only chunk over 500 kB is three.js (src/lib/three/stage.ts). It's fetched on demand, only when a
			// 3D model scrolls into view, so it never affects first load. Anything else this big should still warn.
			chunkSizeWarningLimit: 650,
		},
	},
});
