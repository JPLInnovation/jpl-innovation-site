// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://jpl-innovation.github.io',
	// Load pages in the background when a link is hovered so navigation feels instant.
	prefetch: {
		prefetchAll: true,
		defaultStrategy: 'hover',
	},
});
