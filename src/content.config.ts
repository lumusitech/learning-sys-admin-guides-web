import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    level: z.string().optional(),
    section: z.string().optional(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = { docs };
