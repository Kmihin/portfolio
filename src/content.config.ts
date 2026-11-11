import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

/** An image under public/, with its size so the layout does not jump while it loads. */
const imageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  width: z.number(),
  height: z.number(),
});

const caseStudySchema = z.object({
  title: z.string(),
  /** One line under the title on the case study page. */
  tagline: z.string().optional(),
  /** Short name for the study (not shown on the home page at the moment; the list uses the title). */
  label: z.string().optional(),
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
      /** Text of the live link ("Live site" when missing) and a small note beside it. */
      liveLabel: z.string().optional(),
      liveNote: z.string().optional(),
    })
    .default({}),
  featured: z.boolean().default(false),
  /** Main image at the top of the case study page. */
  cover: imageSchema.optional(),
  /** Features shown as a grid on the case study page: one line each, with a screenshot when there is one. */
  features: z.array(z.object({ text: z.string(), image: imageSchema.optional() })).default([]),
  /** Small note under the feature grid, e.g. that the screenshots use test data. */
  featuresNote: z.string().optional(),
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
  }),
});

const skills = defineCollection({
  loader: file("./content/skills.json"),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    text: z.string(),
  }),
});

export const collections = { projects, professional, profile, services, skills };
