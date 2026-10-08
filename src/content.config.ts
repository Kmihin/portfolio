import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

const caseStudySchema = z.object({
  title: z.string(),
  slug: z.string(),
  type: z.enum(["project", "professional"]),
  year: z.union([z.string(), z.number()]).transform(String),
  summary: z.string(),
  stack: z.array(z.string()),
  role: z.string(),
  links: z
    .object({
      repo: z.string().optional(),
      live: z.string().optional(),
    })
    .default({}),
  featured: z.boolean().default(false),
  /** Optional cover image path under public/, e.g. /work/mojbeach.jpg */
  cover: z.string().optional(),
});

const projects = defineCollection({
  loader: glob({ pattern: "[^_]*.md", base: "./content/projects" }),
  schema: caseStudySchema,
});

const professional = defineCollection({
  loader: glob({ pattern: "[^_]*.md", base: "./content/professional" }),
  schema: caseStudySchema,
});

const profile = defineCollection({
  loader: glob({ pattern: "profile.md", base: "./content" }),
  schema: z.object({
    name: z.string(),
    title: z.string(),
    location: z.string(),
    email: z.string(),
    github: z.string(),
    linkedin: z.string(),
    languages: z.array(z.string()),
    photo: z.string().optional(),
  }),
});

const services = defineCollection({
  loader: file("./content/services.json"),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    text: z.string(),
    /** Particle scene behind this service on the home page (names in src/scripts/shapes.ts). */
    shape: z.string(),
  }),
});

const skills = defineCollection({
  loader: file("./content/skills.json"),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    text: z.string(),
    shape: z.string(),
  }),
});

export const collections = { projects, professional, profile, services, skills };
