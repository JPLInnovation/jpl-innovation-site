import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const collections = {
	work: defineCollection({
		// Load Markdown files in the src/content/work directory.
		loader: glob({ base: './src/content/work', pattern: '**/*.md' }),
		schema: z.object({
			title: z.string(),
			description: z.string(),
			img: z.string(),
			img_alt: z.string().optional(),
			/** Optional short label shown on the project card, e.g. "Coming soon". */
			badge: z.string().optional(),
		}),
	}),
	members: defineCollection({
		loader: glob({ base: './src/content/members', pattern: '**/*.md' }),
		schema: z.object({
			title: z.string(),
			description: z.string(),
			img: z.string(),
			img_alt: z.string().optional(),
			tags: z.array(z.string()),
			technical_skills: z.array(z.object({
				title: z.string(),
				level: z.string(),
				description: z.string()
			})),
			// soft_skills: z.array(z.object({
			// 	title: z.string(),
			// 	description: z.string()
			// })),
		}),
	}),
};
