# Requirements Document

## Introduction

Cadocary Software (Cadocary LLC) recently re-platformed its website onto a content-driven Astro + TypeScript static site (the prior "website-redesign" effort). That work succeeded technically but failed on content and positioning: the site reads like a catalog of small desktop tools, buries the substantial custom software Cadocary has built for clients, presents past client work like blog posts, ships an essentially empty Services page, and suffers visual/legibility problems in the hero carousel (busy backgrounds behind overlay text, images that do not match the product they illustrate).

This feature is a CMO/PR/copywriting-led overhaul of the site's messaging, positioning, and content presentation. It keeps the existing Astro platform, component architecture, and content-model approach; the content model may be extended with new fields and content types. This feature does not re-architect the build system, routing core, or the hydrated carousel behavior.

The primary audience is Evaluators reading Cadocary's RFP responses (government and enterprise procurement-style buyers). The website's single overriding job is to make an Evaluator confident that Cadocary can deliver: it must demonstrate credibility, prove capability through relevant case studies, present a clear software-development services offering, correctly position Cadocary as a builder of serious custom software (not only small tools), and present all of this with professional polish and a clear path to make contact.

This feature explicitly removes the blog entirely. It preserves the prior spec's exclusions: no site-wide search and no login/registration functionality. No fabricated facts about clients or engagements are introduced; content is drawn from and reorganized around existing verifiable material, with structure extended to support case-study framing.

## Glossary

- **Website**: The complete public-facing Cadocary site built on the existing Astro + TypeScript platform, including all pages, navigation, footer, and presentation components.
- **Evaluator**: The primary audience — a person assessing Cadocary's capability while reviewing an RFP response, typically a government or enterprise procurement-style buyer. An Evaluator is an unauthenticated Visitor.
- **Visitor**: Any unauthenticated person browsing the Website (the only user type, since login is excluded). Every Evaluator is a Visitor.
- **Home_Page**: The site root page (`/`) containing the Hero_Section and top-level content sections.
- **Hero_Section**: The primary visual area at the top of the Home_Page containing the Carousel and, beneath it, the Mission_Statement.
- **Carousel**: The slideshow component within the Hero_Section that cycles through Slides.
- **Slide**: A single visual panel within the Carousel, consisting of a background image, overlay text (heading and optional supporting text), and an optional call-to-action link.
- **Overlay_Text**: The heading and supporting text rendered on top of a Slide's background image.
- **Mission_Statement**: The block of positioning copy displayed directly beneath the Carousel that communicates Cadocary's purpose and value.
- **Services_Page**: The page presenting Cadocary's software development services offering.
- **Service_Offering**: A described capability within the Services_Page (for example, custom software development, automation, or AI/ML integration), with supporting copy.
- **Case_Study**: A structured presentation of a completed client engagement organized as problem, approach, what was built, and outcome, written to build Evaluator confidence.
- **Case_Study_Collection**: The set of Case_Studies presented on the Website (the reframed replacement for the prior blog-style "projects" presentation).
- **Product**: An item representing a current Cadocary offering (for example DocketBot, ClientCheck, Highlighter).
- **Product_Catalog**: The collection and presentation of all Products.
- **Capability_Statement**: Positioning copy on the Website that communicates the full scope of Cadocary's software-building capability, making clear that Cadocary builds serious custom software and is not limited to small desktop tools.
- **Blog**: The set of blog posts, the blog index, blog post detail pages, blog routes, and blog navigation/footer entries that existed prior to this feature and are removed by it.
- **Information_Architecture**: The `ia.json`-driven single source of truth from which the Navigation_Bar and Footer Directory are derived.
- **Navigation_Bar**: The persistent top-of-page navigation component derived from the Information_Architecture.
- **Footer**: The persistent bottom-of-page component containing the Directory derived from the Information_Architecture.
- **Directory**: The structured, human-readable sitemap of links in the Footer.
- **Contact_Path**: The means by which an Evaluator reaches Cadocary, centered on the email address `mail@cadocary.com`.
- **Content_Model**: The structured content sources (JSON and typed content files) that drive the Website's rendered content.

## Requirements

### Requirement 1: RFP Evaluator Positioning and Credibility

**User Story:** As an Evaluator reviewing an RFP response, I want the Website to immediately establish Cadocary as a credible, capable software builder, so that I gain confidence Cadocary can deliver the work.

#### Acceptance Criteria

1. WHEN the Home_Page finishes loading on a viewport 768 pixels wide or greater, THE Website SHALL display the Capability_Statement above the fold within 3 seconds of load completion, identifying Cadocary as a builder of custom software for organizations.
2. THE Mission_Statement SHALL present positioning copy that describes Cadocary's software-development capability in terms of outcomes delivered for organizations, rather than describing only individual desktop automation tools.
3. THE Website SHALL present a Services_Page, a Case_Study_Collection, and a Product_Catalog, each reachable from the Navigation_Bar, so that an Evaluator can assess Cadocary's capability, proof of past work, and current offerings.
4. WHEN an Evaluator activates the Navigation_Bar link targeting the Services_Page, the Case_Study_Collection, or the Product_Catalog, THE Website SHALL navigate to the corresponding Page within 2 seconds.
5. THE Website SHALL display the Contact_Path email address `mail@cadocary.com` on the Services_Page and in the Footer.
6. WHERE the Home_Page presents a top-level content section, THE Website SHALL include a call-to-action that, when activated by an Evaluator, navigates the Website to the corresponding detail area (Services_Page, Case_Study_Collection, or a Product detail Page) within 2 seconds.
7. IF a destination reachable from the Navigation_Bar or a Home_Page call-to-action (Services_Page, Case_Study_Collection, Product_Catalog, or a Product detail Page) is unavailable when activated, THEN THE Website SHALL display a message indicating that the requested area cannot be displayed and SHALL preserve the Evaluator's current Page rather than showing a blank page.
8. IF the Capability_Statement content fails to load, THEN THE Website SHALL display placeholder text indicating the positioning content is temporarily unavailable while preserving the reserved above-the-fold layout space.

### Requirement 2: Capability and Product Positioning

**User Story:** As an Evaluator, I want the Website to make clear that Cadocary builds serious custom software, so that I do not mistakenly conclude Cadocary only sells small desktop utilities.

#### Acceptance Criteria

1. WHEN a Page containing the Capability_Statement finishes loading, THE Website SHALL display the Capability_Statement in a fully rendered, visible state, without requiring any Visitor interaction such as clicking, scrolling, or hovering, describing Cadocary's capacity to design and build custom software applications for clients.
2. WHERE the Product_Catalog presents the existing desktop automation Products (DocketBot, ClientCheck, Highlighter), THE Product_Catalog SHALL present those Products under a visible label identifying them as productized offerings, distinct from the Case_Study_Collection label applied to custom client engagements.
3. THE Website SHALL present each custom software engagement built for a previous client within the Case_Study_Collection and SHALL NOT present that engagement within the Product_Catalog, such that every presented item appears in exactly one of the Product_Catalog or the Case_Study_Collection.
4. THE Capability_Statement SHALL describe custom software development using at least 3 distinct named capabilities (for example web platforms, data pipelines, AI/ML integration, and automation), each stated as a concrete capability rather than a subjective qualifier.
5. THE Product_Catalog SHALL present each Product with a name of at most 120 characters and a summary of at most 300 characters.
6. IF the existing content for the Capability_Statement is unavailable, THEN THE Website SHALL display placeholder text indicating the capability content is temporarily unavailable while preserving the reserved layout space for the Capability_Statement.

### Requirement 3: Software Development Services Offering

**User Story:** As an Evaluator, I want a substantive Services page describing Cadocary's software development services, so that I can determine whether Cadocary offers the services my RFP requires.

#### Acceptance Criteria

1. THE Services_Page SHALL present at least one and at most 20 Service_Offering entries, each describing custom software development services.
2. THE Services_Page SHALL present, for each Service_Offering, a name of at most 120 characters and descriptive copy of at least 80 and at most 600 characters that states what Cadocary does for the client.
3. THE Services_Page SHALL present at least one link that resolves to the Case_Study_Collection or to a specific Case_Study as evidence of the described services.
4. THE Services_Page SHALL present the Contact_Path as a `mailto:mail@cadocary.com` link.
5. WHEN a Visitor activates the Contact_Path link, THE Services_Page SHALL invoke the Visitor's default email handler with the recipient address pre-populated as mail@cadocary.com.
6. THE Services_Page SHALL describe each Service_Offering in terms of client outcomes and delivered software, and SHALL NOT use the terms "best", "world-class", or "cutting-edge" as standalone descriptive claims.
7. WHERE a Service_Offering corresponds to work shown in an available Case_Study, THE Services_Page SHALL present a link from that Service_Offering that resolves to the corresponding Case_Study.
8. IF a Service_Offering has no corresponding available Case_Study, THEN THE Services_Page SHALL present that Service_Offering without a Case_Study link rather than presenting a broken or empty link.
9. IF a presented Case_Study or Case_Study_Collection link targets a destination that is unavailable, THEN THE Website SHALL display a page not found response rather than a broken or blank page.

### Requirement 4: Client Work Presented as Case Studies

**User Story:** As an Evaluator, I want past client work presented as structured case studies, so that I can judge whether Cadocary has delivered work relevant to my needs.

#### Acceptance Criteria

1. THE Case_Study_Collection SHALL present each existing client engagement (hotels4truckers.com, purlpal.ai, spendlogic.com) as a Case_Study.
2. THE Website SHALL structure each Case_Study to present a problem statement, an approach, a description of what was built, and an outcome.
3. THE Case_Study_Collection SHALL present each Case_Study with a title of at most 120 characters and a summary of at most 300 characters, and a link to that Case_Study's detail Page.
4. WHEN a Visitor selects a Case_Study, THE Website SHALL navigate to that Case_Study's detail Page within 2 seconds.
5. THE Website SHALL present each Case_Study detail Page using the problem, approach, what-was-built, and outcome content for that engagement.
6. THE Case_Study_Collection SHALL present Case_Studies with no per-item publication date and no reverse-chronological date ordering, and SHALL label the section and its items using client-outcome-oriented language rather than the terms "posts" or "articles".
7. IF the content for a selected Case_Study detail Page is unavailable, THEN THE Website SHALL preserve the Visitor's current Page or route to a dedicated fallback Page, and in either case display a message indicating that the Case_Study details cannot be displayed.
8. WHERE no Case_Studies exist in the Content_Model, THE Case_Study_Collection SHALL display a message indicating that no case studies are currently available.

### Requirement 5: Hero and Overlay Text Legibility

**User Story:** As a Visitor, I want the hero text to be easy to read, so that the site's first impression is polished rather than cluttered.

#### Acceptance Criteria

1. WHEN a Slide is displayed, THE Website SHALL render the Slide's Overlay_Text at a contrast ratio of at least 4.5 to 1 (or at least 3 to 1 for text rendered at 24 pixels or larger, or 18.66 pixels or larger when bold) against the pixels directly behind the Overlay_Text.
2. WHEN a Slide is displayed, THE Website SHALL render the Overlay_Text over a solid or gradient backing layer, or position the Overlay_Text off the background image, such that the contrast ratio required by Criterion 1 is met regardless of the background image content.
3. IF the backing layer behind the Overlay_Text does not achieve the contrast ratio required by Criterion 1, THEN THE Website SHALL increase the backing layer opacity in steps of no more than 10 percent up to a maximum of 100 percent until the required contrast is met, and SHALL keep the Overlay_Text visible throughout.
4. WHILE a Slide is displayed at a viewport width between 320 pixels and 3840 pixels inclusive, THE Website SHALL keep the Slide's heading Overlay_Text and any supporting Overlay_Text fully within the visible bounds of the Slide with no overlap with the Carousel controls.
5. IF the heading Overlay_Text or supporting Overlay_Text exceeds the available Slide width, THEN THE Website SHALL wrap the text within the Slide bounds, and SHALL truncate with a trailing ellipsis after a maximum of 3 lines for the heading and 3 lines for the supporting text rather than overflow the Slide or overlap the Carousel controls.
6. WHEN a Slide is displayed, THE Website SHALL render the Overlay_Text using the Website's defined typography scale and defined color tokens, applying identical token values across all Slides.

### Requirement 6: Image Correspondence and Accuracy

**User Story:** As an Evaluator, I want each image to depict the product or work it accompanies, so that the site appears accurate and trustworthy.

#### Acceptance Criteria

1. WHEN a Slide that references a specific Product or Case_Study is rendered, THE Website SHALL display the image asset that is explicitly associated with that referenced Product or Case_Study in the Content_Model, and SHALL NOT display an image asset associated with any other Product or Case_Study.
2. WHEN a Product is presented with an image, THE Website SHALL display the image asset that is explicitly associated with that Product in the Content_Model, and SHALL NOT display an image asset associated with any other Product or Case_Study.
3. WHEN a Case_Study is presented with an image, THE Website SHALL display the image asset that is explicitly associated with that Case_Study in the Content_Model, and SHALL NOT display an image asset associated with any other Product or Case_Study.
4. WHEN a content image (an image associated with a Slide, Product, or Case_Study, excluding purely decorative images) is rendered, THE Website SHALL provide alternative text of at least 1 and at most 125 characters that names the specific Product, Case_Study, or subject the associated content identifies.
5. IF a referenced image is unavailable in the Content_Model, THEN THE Website SHALL render the associated Slide, Product, or Case_Study with no broken image reference, with the image space collapsed so that no reserved empty area remains, and SHALL display the accompanying text at the same position, size, and styling it would have when the image is present.
6. IF alternative text for a content image is missing in the Content_Model, THEN THE Website SHALL render that image with an empty alternative text attribute and SHALL NOT expose a file name, path, or placeholder token as alternative text.

### Requirement 7: Blog Removal

**User Story:** As the site owner, I want the blog removed entirely, so that the corporate site stays focused on capability and proof rather than articles.

#### Acceptance Criteria

1. THE Website SHALL present zero blog index Pages, zero blog post detail Pages, and zero rendered blog posts.
2. THE Navigation_Bar SHALL present zero navigation entries that link to blog content.
3. THE Footer Directory SHALL present zero links to blog content.
4. WHEN a Visitor requests a previously-existing blog URL path (the blog index path or any blog post detail path), THE Website SHALL return a page-not-found response.
5. THE Website SHALL build successfully after blog removal.
6. THE Website SHALL retain zero references to removed blog Pages, blog routes, or blog content from any retained Page, Navigation_Bar entry, or Footer link.
7. THE Information_Architecture SHALL contain zero blog sections and zero blog Page entries after blog removal.
8. THE Website SHALL contain zero references to removed blog Pages within any generated sitemap or page metadata after blog removal.

### Requirement 8: Professional Polish Restoration

**User Story:** As an Evaluator, I want the site to look as polished as a professional corporate site, so that the presentation reinforces rather than undermines Cadocary's credibility.

#### Acceptance Criteria

1. THE Website SHALL apply the defined typography, color, and spacing tokens to the Home_Page, Services_Page, Product_Catalog, and Case_Study_Collection such that, for each element type (heading levels, body text, links, buttons, and cards), the rendered font family, font size, color, and spacing values are identical across those Pages.
2. IF a defined typography, color, or spacing token is unavailable when a Page renders, THEN THE Website SHALL apply the defined fallback token for that element type rather than an undefined or browser-default style, and SHALL preserve the element's reserved layout space.
3. THE Website SHALL present each top-level content section on the Home_Page with a visible section heading of at least 1 and at most 120 characters and introductory copy of at least 1 sentence that describes the section's purpose.
4. WHILE the viewport width is 320 pixels or greater, THE Website SHALL render every Page's primary content within the horizontal and vertical bounds between the Navigation_Bar and Footer such that zero primary content elements visually overlap the Navigation_Bar or Footer.
5. THE Website SHALL present the Services_Page and Case_Study_Collection such that every section contains rendered body copy of at least 1 sentence and zero sections contain only placeholder text (for example "Lorem ipsum" or "TODO").
6. THE Website SHALL present Product cards, Case_Study cards, and Service_Offering entries using a card presentation in which each card renders a heading, a summary, and a call-to-action, with headings sharing a common baseline alignment and summaries and calls-to-action positioned identically across cards of the same type.

### Requirement 9: Contact and Conversion Path

**User Story:** As an Evaluator who is convinced, I want an obvious way to contact Cadocary, so that I can act on my confidence without hunting for contact details.

#### Acceptance Criteria

1. THE Website SHALL present a Contact_Path on the Services_Page, on the Case_Study_Collection, and in the Footer.
2. THE Website SHALL present the Contact_Path as a `mailto:mail@cadocary.com` link on every Page that presents the Contact_Path.
3. WHEN a Visitor activates the Contact_Path link, THE Website SHALL open the Visitor's default email client with the recipient address pre-filled as `mail@cadocary.com`.
4. THE Website SHALL render the visible text of every Contact_Path link as the literal address `mail@cadocary.com`, so the address is readable without activating the link.
5. WHERE the Home_Page presents the Services section, THE Home_Page SHALL present a visible, interactive call-to-action element, labeled with text referencing the Services, that navigates to the Services_Page when activated.
6. WHERE the Home_Page presents the Case_Study section, THE Home_Page SHALL present a visible, interactive call-to-action element, labeled with text referencing the case studies, that navigates to the Case_Study_Collection when activated.

### Requirement 10: Preserved Feature Exclusions

**User Story:** As the site owner, I want the site to keep excluding search and account features, so that the corporate site stays focused and uncluttered.

#### Acceptance Criteria

1. WHEN any Page is requested, THE Website SHALL render exactly zero site-wide search input elements on that Page.
2. WHEN any Page is requested, THE Website SHALL render exactly zero login controls, links, or forms on that Page.
3. WHEN any Page is requested, THE Website SHALL render exactly zero registration controls, links, or forms on that Page.
4. IF a Visitor navigates to any URL path corresponding to search, login, or registration (`/search`, `/login`, or `/register`), THEN THE Website SHALL return a page-not-found response, SHALL NOT expose any search, login, or registration functionality, and SHALL preserve the not-found response without redirecting to such functionality.
5. WHEN a Visitor requests any Page, THE Website SHALL display the full Page content without prompting for or requiring any authentication credential.
