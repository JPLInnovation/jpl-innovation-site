import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
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
			/** Optional short status shown on the project card, e.g. "Build in progress". */
			badge: z.string().optional(),
			/** Position in project lists; lower comes first. */
			order: z.number().default(99),
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
			/** Leadership titles, e.g. { jpl: "CEO", frc: "Mechanical Lead" }. */
			leadership: z
				.object({
					/** Title at JPL Innovation. */
					jpl: z.string().optional(),
					/** Title on FRC Team 10951. */
					frc: z.string().optional(),
				})
				.optional(),
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
