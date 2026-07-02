# Implementation Plan: Client Carousel

## Overview

Add a responsive client carousel to the Services section of index.html, showcasing previous client engagements via "baseball card" style cards. Implementation uses static HTML, CSS (appended to cadocary.css), and minimal vanilla JavaScript for navigation. Testing uses Vitest + jsdom + fast-check.

## Tasks

- [ ] 1. Add carousel HTML structure to index.html
  - [ ] 1.1 Add carousel container and client cards to the Services section
    - Insert the carousel markup inside `section#services`, after the existing `.hero-right` panel
    - Add the `role="region"` and `aria-label="Client showcase"` attributes to the carousel container
    - Create three `.carousel-card` articles with correct content for hotels4truckers.com, purlpal.ai, and spendlogic.com
    - Each card uses field order: project name (h3), contact name, mailto email link, description
    - Add navigation buttons with `aria-label="Previous client"` and `aria-label="Next client"`
    - Add `.carousel-indicator` element and `.carousel-live` aria-live region
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.6, 6.1, 6.2, 6.3, 6.5_

- [ ] 2. Add carousel styles to cadocary.css
  - [ ] 2.1 Add carousel layout and card styles
    - Add `.carousel`, `.carousel-track`, `.carousel-card`, `.carousel-nav`, `.carousel-prev`, `.carousel-next`, `.carousel-indicator`, `.carousel-live` classes
    - Cards extend existing `.card` class styling (border-radius: 1rem, background: var(--bg-elevated), border: 1px solid var(--border-subtle), padding: 1.2rem 1.25rem)
    - Use only CSS custom properties from `:root` for colors — no hardcoded hex/rgb/hsl
    - Navigation buttons must have minimum 44×44px tap targets
    - Add `transition: transform 300ms ease` on `.carousel-track`
    - Add visually-hidden utility for `.carousel-live`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 3.2, 3.3, 5.3_

  - [ ] 2.2 Add responsive breakpoint styles
    - At viewport > 900px: show all 3 cards, hide navigation controls
    - At 601–900px: show 2 cards, show navigation controls
    - At ≤ 600px: show 1 card at a time (min-width 260px, ≥90% container width), show navigation controls
    - _Requirements: 1.4, 1.5, 1.6, 5.1, 5.2, 5.4_

- [ ] 3. Implement carousel JavaScript logic
  - [ ] 3.1 Add carousel navigation script to index.html
    - Implement `getVisibleCards()` returning 1, 2, or 3 based on viewport width breakpoints
    - Implement `nextCard()` with modular wrapping: `(currentIndex + 1) % totalCards`
    - Implement `prevCard()` with modular wrapping: `(currentIndex - 1 + totalCards) % totalCards`
    - Implement `updateCarousel()` applying `translateX` to `.carousel-track`
    - Implement `updateIndicator()` showing "X of Y" text
    - Implement `updateLiveRegion()` announcing current card name to screen readers
    - Implement `updateNavVisibility()` hiding controls when all cards are visible or fewer than 2 cards exist
    - Add `resize` event listener to recalculate visible cards and clamp currentIndex
    - Wire click and keyboard (Enter/Space) events on navigation buttons
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.4, 6.5_

- [ ] 4. Checkpoint - Verify carousel renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Set up test infrastructure and write tests
  - [ ] 5.1 Set up Vitest with jsdom and fast-check
    - Initialize package.json if not present
    - Install vitest, jsdom, and fast-check as dev dependencies
    - Create vitest.config.js with jsdom environment
    - _Requirements: N/A (test infrastructure)_

  - [ ]* 5.2 Write property test for viewport breakpoint mapping
    - **Property 1: Viewport breakpoint mapping**
    - For any viewport width (positive integer 1–5000), `getVisibleCards(width)` returns 1 when width ≤ 600, 2 when 601 ≤ width ≤ 900, 3 when width > 900
    - **Validates: Requirements 1.4, 1.5, 1.6, 5.2**

  - [ ]* 5.3 Write property test for next navigation wrapping
    - **Property 2: Next navigation wrapping**
    - For any currentIndex in [0, totalCards-1] and totalCards ≥ 1, nextCard() sets currentIndex to `(currentIndex + 1) % totalCards`
    - **Validates: Requirements 3.2, 3.4**

  - [ ]* 5.4 Write property test for previous navigation wrapping
    - **Property 3: Previous navigation wrapping**
    - For any currentIndex in [0, totalCards-1] and totalCards ≥ 1, prevCard() sets currentIndex to `(currentIndex - 1 + totalCards) % totalCards`
    - **Validates: Requirements 3.3, 3.5**

  - [ ]* 5.5 Write property test for position indicator accuracy
    - **Property 4: Position indicator accuracy**
    - For any currentIndex in [0, totalCards-1], indicator text equals `"${currentIndex + 1} of ${totalCards}"`
    - **Validates: Requirements 3.6**

  - [ ]* 5.6 Write property test for aria-live region update
    - **Property 5: Aria-live region update on navigation**
    - For any navigation action from any valid currentIndex, aria-live region is updated with non-empty text containing the newly visible card name
    - **Validates: Requirements 6.5**

  - [ ]* 5.7 Write unit tests for carousel DOM structure and accessibility
    - Verify card content matches requirements for all 3 clients
    - Verify field order (name → contact → email → description)
    - Verify mailto links are correct
    - Verify ARIA attributes on container and buttons
    - Verify navigation controls hidden when fewer than 2 cards
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.2, 6.3, 6.4, 3.7_

- [ ] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Implementation uses HTML + CSS + vanilla JS only (no frameworks or bundlers)
- All carousel styles go into the existing cadocary.css file
- All colors must use existing CSS custom properties from `:root`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6", "5.7"] }
  ]
}
```
