// @ts-check
import { defineConfig } from "astro/config";

// Astro configuration for the website redesign.
//
// Architecture decision (see src/architecture.ts for the full rationale):
// the site is built "static-first" — output: "static" means every page is
// pre-rendered to HTML at build time for maximum speed and SEO. Interactivity
// is added selectively via hydrated islands (only the hero carousel), so the
// vast majority of the site ships zero client-side JavaScript.
export default defineConfig({
  output: "static",
  // Deployed to GitHub Pages on the custom apex domain cadocary.com.
  // `site` sets the canonical origin used for generated absolute URLs and the
  // Schema.org JSON-LD (WebSite/WebPage). The site serves from the domain root,
  // so no `base` is needed. The custom domain binding is kept across deploys by
  // the public/CNAME file (contents: cadocary.com).
  site: "https://cadocary.com",
});
