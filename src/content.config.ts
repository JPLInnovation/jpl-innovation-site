import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

export const collections = {
	work: defineCollection({
		// Project cards (and the cybersecurity write-up): src/text/projects/*.md
		loader: glob({ base: './src/text/projects', pattern: '**/*.md' }),
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
		loader: glob({ base: './src/text/members', pattern: '**/*.md' }),
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
			/** Awards and competitions, one line each. */
			achievements: z.array(z.string()).optional(),
			/** School sports teams, e.g. { sport: "Tennis", team: "SSIS Varsity" }. */
			sports: z.array(z.object({ sport: z.string(), team: z.string() })).optional(),
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
