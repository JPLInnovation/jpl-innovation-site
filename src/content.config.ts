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
			/** Awards and competitions, one row of the table each: { title, result }, or just a line of text. */
			achievements: z
				.array(z.union([z.string(), z.object({ title: z.string(), result: z.string().optional() })]))
				.optional(),
			/** School sports teams, e.g. { sport: "Tennis", team: "SSIS Varsity" }. */
			sports: z.array(z.object({ sport: z.string(), team: z.string() })).optional(),
			/** The first line of their page, e.g. "Xin chào, mình là Jayden." */
			greeting: z.string().optional(),
			/** Their places on the map of Vietnam, in the order their route visits them (degrees north and east). */
			places: z
				.array(z.object({ name: z.string(), note: z.string().optional(), lat: z.number(), lon: z.number() }))
				.optional(),
			/** Their path so far, in order, drawn as stops along the route, e.g. ["LEGO Mindstorms", "Python"]. */
			path: z.array(z.string()).optional(),
			/** One fun true figure, shown in their title block: { label: "…", value: "16 GB" }. */
			fun_fact: z.object({ label: z.string(), value: z.string() }).optional(),
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
