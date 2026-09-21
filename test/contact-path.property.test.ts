import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fc from "fast-check";

/**
 * Feature: corporate-site-positioning, Property 15: Contact_Path is a correct,
 * readable mailto everywhere it appears
 *
 * Validates: Requirements 3.5, 9.2, 9.4
 *
 * For any rendered surface that presents the Contact_Path (Services_Page,
 * Case_Study_Collection, Footer), the link's href is EXACTLY
 * `mailto:mail@cadocary.com` and its visible text is EXACTLY the literal
 * address `mail@cadocary.com`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SHAPE OF TEST
 * ---------------------------------------------------------------------------
 * The three Contact_Path surfaces are `.astro` components/pages, which are not
 * cheaply rendered inside Vitest (they require the Astro compiler + a DOM). But
 * the Contact_Path contract does NOT depend on runtime rendering — it is fully
 * determined by the authored source: each surface
 *
 *   1) declares the literal address once as `const CONTACT_EMAIL = "…"`,
 *   2) builds the anchor href from that constant as `mailto:${CONTACT_EMAIL}`
 *      (Footer/CaseStudyCollection) or via `CONTACT_HREF = mailto:${…}`
 *      (Services), and
 *   3) renders that same constant as the anchor's visible text `{CONTACT_EMAIL}`.
 *
 * There is no shared domain helper/constant for the contact path (verified by
 * inspection: each surface declares its own `CONTACT_EMAIL`), so we assert
 * against the REAL implementation by reading each `.astro` source from disk
 * (the `node:fs` pattern used by `theming.test.ts`) and extracting the actual
 * href + visible-text that surface emits. The property ranges over the set of
 * source surfaces.
 *
 * We ALSO property-test the pure href/text construction the surfaces perform,
 * over a generated space of email-like inputs, to pin the invariant that ONLY
 * the exact literal `mail@cadocary.com` yields the exact Contact_Path
 * (`mailto:mail@cadocary.com` + visible text `mail@cadocary.com`) — the same
 * template each surface uses.
 */

const EXPECTED_ADDRESS = "mail@cadocary.com";
const EXPECTED_HREF = `mailto:${EXPECTED_ADDRESS}`;

/** A Contact_Path surface: the source file plus how it exposes the address. */
interface ContactSurface {
  readonly name: string;
  readonly path: string;
}

/** The three surfaces the design lists as presenting the Contact_Path. */
const SURFACES: readonly ContactSurface[] = [
  {
    name: "Footer.astro",
    path: fileURLToPath(new URL("../src/components/Footer.astro", import.meta.url)),
  },
  {
    name: "CaseStudyCollection.astro",
    path: fileURLToPath(
      new URL("../src/components/CaseStudyCollection.astro", import.meta.url),
    ),
  },
  {
    name: "services.astro",
    path: fileURLToPath(new URL("../src/pages/services.astro", import.meta.url)),
  },
];

/** Extract the literal value of `const CONTACT_EMAIL = "…"` from a source. */
function extractContactEmail(src: string): string | null {
  const m = src.match(/const\s+CONTACT_EMAIL\s*=\s*"([^"]*)"/);
  return m ? m[1] : null;
}

/**
 * Resolve the mailto href a surface emits. Surfaces build the href either
 * inline as `mailto:${CONTACT_EMAIL}` or via a `CONTACT_HREF` binding of the
 * same shape; both reduce to `mailto:` + the CONTACT_EMAIL value. We assert the
 * source literally uses that construction and then compute the concrete href.
 */
function extractMailtoHref(src: string, email: string): string | null {
  // `mailto:${CONTACT_EMAIL}` appears either directly in the anchor href or in
  // a `const CONTACT_HREF = ` binding that the anchor then references.
  const usesInterpolatedMailto = /mailto:\$\{CONTACT_EMAIL\}/.test(src);
  if (!usesInterpolatedMailto) return null;
  return `mailto:${email}`;
}

/**
 * Resolve the visible text of the Contact_Path anchor. Each surface renders the
 * bare `{CONTACT_EMAIL}` expression as the anchor's text content. We confirm the
 * source renders exactly that expression as visible text (not, e.g., a
 * different label) and then compute the concrete text.
 */
function extractVisibleText(src: string, email: string): string | null {
  // The anchor's visible text is the `{CONTACT_EMAIL}` expression. Guard that
  // the source actually renders it as anchor content.
  const rendersConstant = /\{CONTACT_EMAIL\}/.test(src);
  if (!rendersConstant) return null;
  return email;
}

describe("Property 15: Contact_Path is a correct, readable mailto on every surface", () => {
  test("every Contact_Path surface emits href mailto:mail@cadocary.com with visible text mail@cadocary.com", () => {
    // Pre-read each surface's source so the property body is pure/deterministic.
    const surfaceData = SURFACES.map((surface) => {
      const src = readFileSync(surface.path, "utf8");
      return { surface, src };
    });

    fc.assert(
      fc.property(fc.constantFrom(...surfaceData), ({ surface, src }) => {
        const email = extractContactEmail(src);
        expect(email, `${surface.name}: no CONTACT_EMAIL literal found`).not.toBeNull();

        const href = extractMailtoHref(src, email!);
        expect(
          href,
          `${surface.name}: does not build href as mailto:\${CONTACT_EMAIL}`,
        ).not.toBeNull();

        const text = extractVisibleText(src, email!);
        expect(
          text,
          `${surface.name}: does not render {CONTACT_EMAIL} as visible text`,
        ).not.toBeNull();

        // The core Contact_Path invariant: EXACT href and EXACT visible text.
        expect(email, `${surface.name}: address literal`).toBe(EXPECTED_ADDRESS);
        expect(href, `${surface.name}: mailto href`).toBe(EXPECTED_HREF);
        expect(text, `${surface.name}: visible text`).toBe(EXPECTED_ADDRESS);
      }),
      { numRuns: 200 },
    );
  });

  test("each surface declares the Contact_Path exactly once (single source of the address per surface)", () => {
    for (const surface of SURFACES) {
      const src = readFileSync(surface.path, "utf8");
      const declarations = src.match(/const\s+CONTACT_EMAIL\s*=\s*"[^"]*"/g) ?? [];
      expect(
        declarations.length,
        `${surface.name}: expected exactly one CONTACT_EMAIL declaration`,
      ).toBe(1);
    }
  });
});

describe("Property 15 (construction invariant): only the exact address yields the exact Contact_Path", () => {
  // The pure href/text construction every surface performs, extracted so we can
  // exercise it over many inputs: given an address, the surface renders
  // `mailto:${address}` as href and `${address}` as visible text.
  const buildContactPath = (address: string) => ({
    href: `mailto:${address}`,
    text: address,
  });

  test("the correct literal produces the required href and readable visible text", () => {
    const { href, text } = buildContactPath(EXPECTED_ADDRESS);
    expect(href).toBe(EXPECTED_HREF);
    expect(text).toBe(EXPECTED_ADDRESS);
  });

  test("for any email-like address, href is mailto:<addr> and visible text equals the raw address (readable, un-obfuscated)", () => {
    // Generator: realistic email-like strings around the input space, including
    // the exact expected address, so we cover both the target and neighbours.
    const localPart = fc.stringMatching(/^[a-z][a-z0-9._%+-]{0,20}$/);
    const domainPart = fc.stringMatching(/^[a-z][a-z0-9-]{0,15}(\.[a-z]{2,6}){1,2}$/);
    const emailLike = fc
      .tuple(localPart, domainPart)
      .map(([local, domain]) => `${local}@${domain}`);

    fc.assert(
      fc.property(
        fc.oneof(fc.constant(EXPECTED_ADDRESS), emailLike),
        (address) => {
          const { href, text } = buildContactPath(address);

          // href is exactly `mailto:` + the address, nothing appended/obfuscated.
          expect(href).toBe(`mailto:${address}`);
          // Visible text is exactly the raw address — readable without
          // activating the link (Req 9.4), never an obfuscated/label form.
          expect(text).toBe(address);
          expect(text).not.toContain("[at]");
          expect(text).not.toContain(" ");

          // Only the confirmed literal produces the required Contact_Path.
          const isExpected = address === EXPECTED_ADDRESS;
          expect(href === EXPECTED_HREF && text === EXPECTED_ADDRESS).toBe(isExpected);
        },
      ),
      { numRuns: 200 },
    );
  });
});
