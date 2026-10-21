// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
// @ts-ignore: the project has no Node type definitions; this only runs in the dev server
import { existsSync } from 'node:fs';

/**
 * The standalone pages in public/ (the drone's build guide, 3D layout, camera mount and Camera POV) are folders with
 * an index.html. GitHub Pages and `astro preview` serve /work/drone/camera-pov/ from that file; the dev server
 * doesn't, so it showed "Page not found". This does the same in `npm run dev`. Dev only: the build is unchanged.
 */
/** @type {import('vite').Plugin} */
const publicFolderIndex = {
	name: 'public-folder-index',
	configureServer(server) {
		server.middlewares.use((request, _res, next) => {
			const req = /** @type {{ url?: string }} */ (request);
			const [path, query] = (req.url ?? '').split('?');
			if (path.endsWith('/') && path !== '/' && existsSync(`public${decodeURIComponent(path)}index.html`)) {
				req.url = `${path}index.html${query ? `?${query}` : ''}`;
			}
			next();
		});
	},
};

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
		plugins: [tailwindcss(), publicFolderIndex],
		build: {
			// The only chunk over 500 kB is three.js (src/lib/three/stage.ts). It's fetched on demand, only when a
			// 3D model scrolls into view, so it never affects first load. Anything else this big should still warn.
			chunkSizeWarningLimit: 650,
		},
	},
});
