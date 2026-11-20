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
  /** Short name for the index on the home page; the title is used when missing. */
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

// English in content/, Slovenian in content/sl/ (the same files, translated).
const projects = defineCollection({
  loader: glob({ pattern: "[^_]*.md", base: "./content/projects" }),
  schema: caseStudySchema,
});

const professional = defineCollection({
  loader: glob({ pattern: "[^_]*.md", base: "./content/professional" }),
  schema: caseStudySchema,
});

const projectsSl = defineCollection({
  loader: glob({ pattern: "[^_]*.md", base: "./content/sl/projects" }),
  schema: caseStudySchema,
});

const professionalSl = defineCollection({
  loader: glob({ pattern: "[^_]*.md", base: "./content/sl/professional" }),
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

const listItem = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
});

const services = defineCollection({ loader: file("./content/services.json"), schema: listItem });
const skills = defineCollection({ loader: file("./content/skills.json"), schema: listItem });
const servicesSl = defineCollection({ loader: file("./content/sl/services.json"), schema: listItem });
const skillsSl = defineCollection({ loader: file("./content/sl/skills.json"), schema: listItem });

export const collections = { projects, professional, projectsSl, professionalSl, profile, services, skills, servicesSl, skillsSl };
