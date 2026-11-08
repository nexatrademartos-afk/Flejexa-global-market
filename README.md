FleJexa GLOBAL MART

Shop More. Save More. Get Rewarded.

Powered by TJC-OS — the powering system behind FleJexa GLOBAL MART.

NEXA GLOBAL MART is a global marketplace project built to bring customers, sellers, and commerce services together through a unified digital platform. The project is designed to evolve as new marketplace features, customer services, seller tools, and platform capabilities are developed.

Table of Contents

- "Project Vision" (#project-vision)
- "Brand Identity" (#brand-identity)
- "Technology Stack" (#technology-stack)
- "Getting Started" (#getting-started)
- "Available Commands" (#available-commands)
- "Project Structure" (#project-structure)
- "Supabase Integration" (#supabase-integration)
- "Development Guidelines" (#development-guidelines)
- "Testing and Quality Assurance" (#testing-and-quality-assurance)
- "Branding and Application-Wide Requirements" (#branding-and-application-wide-requirements)
- "Contributing" (#contributing)
- "Deployment Readiness" (#deployment-readiness)
- "Project Ownership and Direction" (#project-ownership-and-direction)

Project Vision

NEXA GLOBAL MART aims to provide a unified marketplace experience with a foundation that can support the continued development of:

- Customer accounts and account management.
- Product discovery and shopping experiences.
- Seller participation and marketplace services.
- Secure authentication and data access.
- Responsive experiences across mobile and desktop devices.
- Future commerce, rewards, and platform integrations.

These are project goals, not a claim that every feature is already implemented. Feature availability must be verified against the current application before being represented as complete.

Brand Identity

The official marketplace name is FleJexa GLOBAL MART.

Element| Official identity
Marketplace name| NEXA GLOBAL MART
Slogan| Shop More. Save More. Get Rewarded.
Powering system| TJC-OS
Platform attribution| Powered by TJC-OS

Naming rules

- Use NEXA GLOBAL MART consistently in page headings, navigation, metadata, documentation, and customer-facing copy.
- Use TJC-OS when referring to the powering system.
- Use Powered by TJC-OS for the platform attribution.
- Avoid using older marketplace names in new customer-facing content.
- Keep internal repository paths and technical identifiers unchanged unless a deliberate migration is planned.

Technology Stack

The current project uses the following technologies:

- React for the user interface.
- TypeScript for typed application code.
- TanStack Start for the application framework.
- TanStack Router for routing.
- TanStack Query for asynchronous data management.
- Vite for development and production builds.
- Tailwind CSS for styling.
- Supabase for backend services and authentication integration.
- Vitest for automated tests.
- ESLint for code-quality checks.
- Prettier for code formatting.

The installed dependencies and scripts in "package.json" are the source of truth for the current toolchain.

Getting Started

Prerequisites

Install:

- Git.
- Node.js compatible with the installed Vite version.
- npm, which is included with Node.js.
- A code editor such as Visual Studio Code.

1. Clone the repository

git clone https://github.com/nexatrademartos-afk/nexa-global-market.git
cd nexa-global-market

2. Install dependencies

npm install

3. Start the development server

npm run dev

Open the local URL printed by the development server in your browser.

4. Create a production build

npm run build

The build must complete successfully before changes are considered ready for release.

Available Commands

Run the following commands from the project root.

Command| Purpose
"npm run dev"| Starts the development server.
"npm run build"| Creates a production build.
"npm run build:dev"| Creates a build using development mode.
"npm run preview"| Serves a production build for local preview.
"npm run lint"| Runs ESLint checks.
"npm run test"| Runs the Vitest test suite once.
"npm run test:watch"| Runs Vitest in watch mode.
"npm run format"| Formats files using Prettier.

Important: "npm run format" uses "prettier --write .", which may modify multiple files. Review the resulting changes before committing them.

Project Structure

The following paths have been identified in the current repository:

nexa-global-market/
├── src/
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts
│   │       ├── previewAuthStorage.ts
│   │       └── types.ts
│   ├── lib/
│   │   ├── error-capture.ts
│   │   ├── error-page.ts
│   │   └── lovable-error-reporting.ts
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   └── account.index.tsx
│   └── styles.css
├── package.json
├── vite.config.ts
└── README.md

This is a partial overview of the files inspected, not a complete inventory of every file in the repository.

Important application areas

- "src/routes/" contains route-level application pages.
- "src/routes/__root.tsx" provides the shared root layout and application-level structure.
- "src/routes/index.tsx" contains the home page.
- "src/routes/account.index.tsx" contains the customer account page.
- "src/integrations/supabase/" contains the Supabase client integration and related types.
- "src/styles.css" contains application styling.
- "vite.config.ts" configures the development and build toolchain.
- "package.json" defines dependencies and development commands.

Always inspect the actual implementation before modifying a file or assuming a feature is complete.

Supabase Integration

The project currently uses "@supabase/supabase-js".

The Supabase client is defined in:

"src/integrations/supabase/client.ts"

Before changing the Supabase integration:

1. Inspect the current client configuration and authentication settings.
2. Preserve the authentication behaviour required by the application.
3. Verify which components and routes depend on Supabase.
4. Test sign-in, sign-out, session persistence, and account access after any relevant changes.
5. Confirm the intended Supabase project before deploying changes.

The current client configuration includes project connection values in source code. A future configuration improvement may move environment-specific values into environment variables, provided the application and deployment environments are updated together.

Security rule: Never expose a Supabase service-role key or other privileged secret in browser-side code. Public client configuration must use an appropriate publishable key and rely on correctly configured database permissions and Row Level Security (RLS).

Do not delete authentication-storage code simply because it contains references to a previous development platform. First confirm its purpose, dependencies, and replacement behaviour.

Development Guidelines

1. Inspect before changing

Before editing a file:

- Confirm that the file exists.
- Read its current implementation.
- Identify its imports, dependencies, and callers.
- Understand its role in the application.
- Decide whether to extend, replace, or remove it.

2. Make focused changes

- Prefer changes that address one clear objective at a time.
- Preserve working functionality unless a change is intentional.
- Avoid unrelated refactoring in the same change.
- Update dependent files when an interface or configuration changes.

3. Keep changes reviewable

- Use meaningful file and component names.
- Keep TypeScript types accurate.
- Avoid duplicate implementations of shared behaviour.
- Review the final diff before committing.
- Do not report a feature as complete until it has been tested.

4. Remove obsolete integrations safely

When removing an external development-platform integration:

- Search for imports, dependencies, configuration, scripts, and runtime references.
- Replace required functionality before deleting the old implementation.
- Update the package manifest and the applicable lockfile together.
- Run lint, tests, and the production build.
- Check authentication, routing, and application startup after the change.

Testing and Quality Assurance

Run the project's available checks:

npm run lint
npm run test
npm run build

A successful release candidate should satisfy the following:

- The application starts without critical errors.
- The production build completes successfully.
- Automated tests pass.
- Lint checks pass, or remaining issues are documented and understood.
- Main navigation and customer account routes behave correctly.
- Supabase-dependent features work as expected.
- Responsive layouts remain usable on mobile and desktop.
- Branding is consistent across the application.
- No obsolete integration is removed while still required by active code.

A command returning a non-zero exit status must be investigated and fixed before the affected change is considered verified.

Branding and Application-Wide Requirements

Official marketplace branding

Use NEXA GLOBAL MART consistently throughout the customer-facing application.

This includes, where applicable:

- Page titles and metadata.
- Home page branding.
- Header and navigation.
- Account pages.
- Shared footer.
- Loading and error states.
- Authentication screens.
- Mobile layouts.
- Documentation and release notes.

Powered-by attribution

Powered by TJC-OS must identify the system powering NEXA GLOBAL MART.

The intended application-wide behaviour is:

- The attribution must appear on every applicable page.
- It must be implemented through the shared application layout or another genuinely application-wide component, rather than copied independently into every route.
- It must appear at the bottom of the page after the page content, so visitors can see it when they scroll to the end.
- It must remain legible and accessible on mobile and desktop.
- It must not cover buttons, forms, content, or navigation.
- It must not be duplicated when pages share the same layout.

These requirements must be implemented and verified in the application code. Documenting them here does not itself add the footer to the application.

Contributing

Contributions should support the goals and standards of NEXA GLOBAL MART.

Before submitting a change:

1. Understand the relevant code and existing behaviour.
2. Keep the change focused on its stated objective.
3. Follow the established React and TypeScript patterns.
4. Preserve application security and authentication behaviour.
5. Run lint, tests, and a production build.
6. Review the final diff for unintended changes.
7. Explain what changed and what was tested.

Do not commit credentials, private keys, access tokens, or other secrets.

Deployment Readiness

Before deploying a release:

- Confirm the target environment and Supabase project.
- Verify the production configuration.
- Run the production build.
- Check authentication and database permissions.
- Test the main marketplace and account routes.
- Review browser and server logs for critical errors.
- Confirm the NEXA GLOBAL MART branding and Powered by TJC-OS attribution.
- Verify that no required integration or environment setting has been omitted.

Deployment-specific instructions should be added after the actual hosting target and its configuration are confirmed.

Project Ownership and Direction

NEXA GLOBAL MART is the marketplace application.

TJC-OS is the system identified as powering the marketplace.

Development decisions should preserve this distinction, support the long-term marketplace vision, and prioritize security, reliability, accessibility, maintainability, and a consistent customer experience.

---

NEXA GLOBAL MART
Shop More. Save More. Get Rewarded.

Powered by TJC-OS
