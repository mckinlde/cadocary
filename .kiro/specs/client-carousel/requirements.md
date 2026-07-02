# Requirements Document

## Introduction

Add a carousel of "baseball card" style client cards to the Services section of the Cadocary website (index.html). The carousel showcases previous clients to establish credibility and social proof for the consulting services offering. The implementation must use only static HTML and CSS (with minimal vanilla JS for carousel interaction), consistent with the existing site architecture.

## Glossary

- **Carousel**: A horizontally-scrollable or auto-rotating UI component that displays a set of cards one or more at a time
- **Client_Card**: A styled card element ("baseball card") displaying a client's project name, contact person, contact email, and a brief project description
- **Services_Section**: The existing "Services" section (id="services") in index.html
- **Site**: The Cadocary static HTML website served from index.html with cadocary.css

## Requirements

### Requirement 1: Display Client Cards in a Carousel

**User Story:** As a site visitor, I want to see a carousel of previous client cards in the Services section, so that I can understand the breadth of work Cadocary has done.

#### Acceptance Criteria

1. THE Carousel SHALL display Client_Cards for the following three clients: hotels4truckers.com, purlpal.ai, and spendlogic.com
2. WHEN the Services_Section is rendered, THE Carousel SHALL be visible below the existing Services section content
3. THE each Client_Card SHALL display at minimum the client name as a text label
4. WHILE the viewport width is greater than 900px, THE Carousel SHALL display 3 Client_Cards simultaneously
5. WHILE the viewport width is between 601px and 900px, THE Carousel SHALL display 2 Client_Cards simultaneously
6. WHILE the viewport width is 600px or less, THE Carousel SHALL display 1 Client_Card at a time and provide a horizontal navigation mechanism to access the remaining cards

### Requirement 2: Client Card Content

**User Story:** As a site visitor, I want each client card to show the project name, contact person, email, and a description, so that I can learn about each engagement.

#### Acceptance Criteria

1. THE Client_Card for hotels4truckers.com SHALL display the project name "hotels4truckers.com", the contact name "Dan Fuller", the contact email "dan@hotels4truckers.com", and the description "A booking platform for hotels with trucker-friendly parking, on web and mobile"
2. THE Client_Card for purlpal.ai SHALL display the project name "purlpal.ai", the contact name "Andy Barr", the contact email "el.andy.barr@gmail.com", and the description "A RAG-enabled chatbot over Medicare Advantage plans, and associated webscraping"
3. THE Client_Card for spendlogic.com SHALL display the project name "spendlogic.com", the contact name "Adam Shovav", the contact email "adam@thedreamers.us", and the description "A procurement compliance documentation templating engine"
4. THE Client_Card SHALL display its fields in the following order from top to bottom: project name, contact name, contact email, and description
5. THE Client_Card SHALL render the contact email as a clickable mailto link that opens the visitor's default email client when activated
6. THE Client_Card SHALL display the project name as the card heading, visually distinct from the other fields through larger or bolder text

### Requirement 3: Carousel Navigation

**User Story:** As a site visitor, I want to navigate between client cards, so that I can browse through all previous clients.

#### Acceptance Criteria

1. THE Carousel SHALL display one Client_Card at a time and provide a visible left arrow control and a visible right arrow control, each operable by mouse click and keyboard activation, to cycle through Client_Cards
2. WHEN the user activates the right navigation control, THE Carousel SHALL replace the currently displayed Client_Card with the next Client_Card within 300 milliseconds
3. WHEN the user activates the left navigation control, THE Carousel SHALL replace the currently displayed Client_Card with the previous Client_Card within 300 milliseconds
4. WHEN the Carousel reaches the last Client_Card and the user activates the right navigation control, THE Carousel SHALL wrap around to the first Client_Card
5. WHEN the Carousel is at the first Client_Card and the user activates the left navigation control, THE Carousel SHALL wrap around to the last Client_Card
6. THE Carousel SHALL display a position indicator showing the current Client_Card index and total number of Client_Cards (e.g., "2 of 3")
7. IF the Carousel contains fewer than 2 Client_Cards, THEN THE Carousel SHALL hide the left and right navigation controls

### Requirement 4: Visual Consistency

**User Story:** As a site owner, I want the carousel to match the existing site design, so that it feels like a natural part of the page.

#### Acceptance Criteria

1. THE Client_Card SHALL use the `.card` class styling conventions defined in cadocary.css: `border-radius: 1rem`, `background: var(--bg-elevated)`, `border: 1px solid var(--border-subtle)`, and `padding: 1.2rem 1.25rem`
2. THE Carousel SHALL reference only CSS custom properties defined in `:root` for all color values, with no hardcoded color literals (hex, rgb, or hsl) in carousel-related rules
3. THE Carousel styles SHALL be added to cadocary.css rather than inline styles or a separate stylesheet
4. THE Carousel SHALL use `var(--font-main)` for all text elements and apply existing text color variables (`--text-main`, `--text-muted`, `--text-subtle`) consistent with their usage elsewhere in cadocary.css

### Requirement 5: Responsive Behavior

**User Story:** As a mobile visitor, I want the carousel to adapt to smaller screens, so that I can still browse clients on my phone.

#### Acceptance Criteria

1. WHILE the viewport width is 600px or less, THE Carousel SHALL display one Client_Card at a time occupying at least 90% of the carousel container width
2. WHILE the viewport width is greater than 600px, THE Carousel SHALL display 2 or more Client_Cards simultaneously based on available width
3. THE Carousel navigation controls SHALL have a minimum tap target size of 44×44 CSS pixels on all viewport widths
4. WHILE the viewport width is 600px or less, THE Client_Card SHALL have a minimum width of 260px

### Requirement 6: Accessibility

**User Story:** As a visitor using assistive technology, I want the carousel to be navigable and understandable, so that I can access client information regardless of how I browse.

#### Acceptance Criteria

1. THE Carousel navigation controls SHALL have aria-label attributes that indicate their direction of navigation (e.g., indicating previous or next)
2. THE Carousel container SHALL be identified with role="region" and an aria-label that describes its purpose as a client showcase
3. THE Client_Card contact email SHALL be a clickable mailto link with link text that includes the email address
4. THE Carousel SHALL be fully operable via keyboard, allowing users to activate navigation controls using Enter or Space keys
5. WHEN the Carousel advances to a new Client_Card, THE Carousel SHALL update an aria-live="polite" region so screen readers announce the change
