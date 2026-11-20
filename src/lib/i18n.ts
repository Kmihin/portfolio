// The site in two languages: English at /, Slovenian under /sl/. The home page's copy comes from
// content/home/<lang>.json; the case studies, skills and services from content/ (English) and
// content/sl/ (Slovenian).
import en from "../../content/home/en.json";
import sl from "../../content/home/sl.json";

export type Lang = "en" | "sl";
export type Copy = typeof en;

/** The home page's copy and the site's labels in a language. */
export function copy(lang: Lang): Copy {
  return lang === "sl" ? sl : en;
}

/** The language of a page, by its path. */
export function langOf(path: string): Lang {
  return path === "/sl" || path.startsWith("/sl/") ? "sl" : "en";
}

/** Where a language's pages start: "/" or "/sl/". */
export function homePath(lang: Lang) {
  return lang === "sl" ? "/sl/" : "/";
}

/** The same page in the other language. */
export function otherPath(path: string) {
  if (langOf(path) === "sl") return path.replace(/^\/sl/, "") || "/";
  return "/sl" + path;
}
