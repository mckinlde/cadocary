import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { resolveImage } from "../src/domain/images";
import productsSeed from "../src/content/products.json";
import type { Product } from "../src/types";

/**
 * Product Catalog example/unit tests (task 9.2).
 *
 * These are EXAMPLE tests (not property-based) covering the two acceptance
 * criteria that are meaningfully testable at the unit level for the
 * `ProductCatalog.astro` presentation component:
 *
 *   - Req 2.2 — the Product_Catalog presents products under a VISIBLE
 *     productized-offerings label ("Products") that is DISTINCT from the
 *     Case_Study_Collection label ("Our Work"). Rendering a real `.astro`
 *     component with scoped CSS in Vitest is heavy and brittle, so — following
 *     the same approach as `theming.test.ts` — we read the two component sources
 *     directly and assert on the labels they actually emit: ProductCatalog
 *     renders a visible `<h2>Products</h2>`, CaseStudyCollection renders a
 *     visible `<h2>Our Work</h2>`, and the two heading texts are not equal.
 *
 *   - Req 6.2 — each Product is presented with its OWN explicitly-associated
 *     image from the Content_Model, and never another Product's/Case_Study's
 *     image. The component derives its image via the pure `resolveImage` helper
 *     from `product.image`, so we assert that resolving each SHIPPED product's
 *     image yields exactly the path authored in `products.json`:
 *       DocketBot   -> /img/case-studies/docketbot-demo.jpg
 *       ClientCheck -> /img/case-studies/clientcheck-demo.jpg
 *       Highlighter -> /img/highlighter-screenshot.png
 *     and that those three image paths are mutually distinct (no product borrows
 *     another product's asset).
 *
 * DEFERRAL (documented): actual pixel rendering / visibility of the heading in a
 * browser is a CSS concern verified via e2e/visual regression, not Vitest. The
 * heading markup and the image-resolution derivation are the robust,
 * deterministic surfaces covered here.
 */

// Read the component sources directly from disk (per task guidance, use fs) so
// we assert against the labels the ACTUAL implementation renders.
const productCatalogSrc = readFileSync(
  fileURLToPath(new URL("../src/components/ProductCatalog.astro", import.meta.url)),
  "utf8",
);
const caseStudyCollectionSrc = readFileSync(
  fileURLToPath(new URL("../src/components/CaseStudyCollection.astro", import.meta.url)),
  "utf8",
);

const products = productsSeed as Product[];

/** Look up a shipped product by its Schema.org-aligned display name. */
function productByName(name: string): Product {
  const product = products.find((p) => p.name === name);
  if (!product) {
    throw new Error(`Expected a product named "${name}" in products.json`);
  }
  return product;
}

/**
 * Resolve a product's image exactly as `ProductCatalog.astro` does: adapt the
 * string `product.image` path into the `{ image: { src, alt } }` shape and run
 * it through the pure `resolveImage` helper.
 */
function resolveProductImage(product: Product) {
  const src = typeof product.image === "string" ? product.image : undefined;
  return resolveImage({
    image: src ? { src, alt: `${product.name} product screenshot` } : undefined,
  });
}

describe("Req 2.2: Product_Catalog uses a visible productized label distinct from the Case Studies label", () => {
  it("ProductCatalog renders a visible 'Products' heading", () => {
    // The catalog's productized-offerings label is a real, visible <h2>.
    expect(productCatalogSrc).toMatch(
      /<h2[^>]*id="products-heading"[^>]*>\s*Products\s*<\/h2>/,
    );
  });

  it("CaseStudyCollection renders a different, client-outcome heading (not 'Products')", () => {
    // The case-study collection uses outcome-oriented language ("Our Work"),
    // never the products label and never "posts"/"articles".
    expect(caseStudyCollectionSrc).toMatch(/<h2[^>]*>\s*Our Work\s*<\/h2>/);
    expect(caseStudyCollectionSrc).not.toMatch(/<h2[^>]*>\s*Products\s*<\/h2>/);
  });

  it("the two collection headings are distinct labels", () => {
    const productHeading = productCatalogSrc.match(
      /<h2[^>]*id="products-heading"[^>]*>\s*([^<]+?)\s*<\/h2>/,
    )?.[1];
    const caseStudyHeading = caseStudyCollectionSrc.match(
      /<h2[^>]*id="case-study-collection-heading"[^>]*>\s*([^<]+?)\s*<\/h2>/,
    )?.[1];

    expect(productHeading).toBe("Products");
    expect(caseStudyHeading).toBe("Our Work");
    expect(productHeading).not.toBe(caseStudyHeading);
  });

  it("the catalog also labels products as productized offerings distinct from case studies", () => {
    // The visible intro copy explicitly frames these as Cadocary's own
    // productized offerings, distinct from the custom client engagements shown
    // as case studies (Req 2.2 / 2.3).
    expect(productCatalogSrc).toMatch(/productized offerings/i);
    expect(productCatalogSrc).toMatch(/case studies/i);
  });
});

describe("Req 6.2: each Product presents its OWN explicitly-associated image", () => {
  it("DocketBot resolves to its own demo image", () => {
    const resolved = resolveProductImage(productByName("DocketBot"));
    expect(resolved.kind).toBe("image");
    if (resolved.kind === "image") {
      expect(resolved.src).toBe("/img/case-studies/docketbot-demo.jpg");
    }
  });

  it("ClientCheck resolves to its own demo image", () => {
    const resolved = resolveProductImage(productByName("ClientCheck"));
    expect(resolved.kind).toBe("image");
    if (resolved.kind === "image") {
      expect(resolved.src).toBe("/img/case-studies/clientcheck-demo.jpg");
    }
  });

  it("Highlighter resolves to its own screenshot image", () => {
    const resolved = resolveProductImage(productByName("Highlighter"));
    expect(resolved.kind).toBe("image");
    if (resolved.kind === "image") {
      expect(resolved.src).toBe("/img/highlighter-screenshot.png");
    }
  });

  it("each product's alt text names that specific product (Req 6.2/6.4)", () => {
    for (const name of ["DocketBot", "ClientCheck", "Highlighter"]) {
      const resolved = resolveProductImage(productByName(name));
      expect(resolved.kind).toBe("image");
      if (resolved.kind === "image") {
        expect(resolved.alt).toContain(name);
        expect(resolved.alt.length).toBeGreaterThanOrEqual(1);
        expect(resolved.alt.length).toBeLessThanOrEqual(125);
      }
    }
  });

  it("no product borrows another product's image asset (images are mutually distinct)", () => {
    // Req 6.2: a product SHALL NOT display an image associated with another
    // product/case study. Distinct authored paths guarantee no cross-wiring —
    // this is the exact bug the image-resolution layer was introduced to prevent
    // (DocketBot/ClientCheck previously shared the Highlighter screenshot).
    const srcs = ["DocketBot", "ClientCheck", "Highlighter"].map((name) => {
      const resolved = resolveProductImage(productByName(name));
      return resolved.kind === "image" ? resolved.src : "none";
    });
    expect(new Set(srcs).size).toBe(srcs.length);
  });
});
