// The content of a language, sorted as the site shows it.
import { getCollection } from "astro:content";
import type { Lang } from "./i18n";

// "2022-2026" counts as 2026.
function lastYear(entry: { data: { year: string } }) {
  return entry.data.year.split("-").pop() ?? "";
}

// Featured studies first, then the most recently active.
function byFeaturedThenYear(a: any, b: any) {
  return Number(b.data.featured) - Number(a.data.featured) || lastYear(b).localeCompare(lastYear(a));
}

function byId(a: any, b: any) {
  return a.data.id.localeCompare(b.data.id);
}

/** The case studies: work from employment first, then my own products. */
export async function workOf(lang: Lang) {
  const professional = await getCollection(lang === "sl" ? "professionalSl" : "professional");
  const projects = await getCollection(lang === "sl" ? "projectsSl" : "projects");
  return [...professional.sort(byFeaturedThenYear), ...projects.sort(byFeaturedThenYear)];
}

export async function skillsOf(lang: Lang) {
  return (await getCollection(lang === "sl" ? "skillsSl" : "skills")).sort(byId);
}

export async function servicesOf(lang: Lang) {
  return (await getCollection(lang === "sl" ? "servicesSl" : "services")).sort(byId);
}
