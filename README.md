# CloudCore AI

A responsive frontend for **CloudCore AI — A product of PTCL Smart Cloud**, closely based on the four supplied design references.

## Run locally

Requires Node.js. No package installation is needed.

```sh
npm start
```

Open http://127.0.0.1:4173. Run `npm run check` for source and interaction-state checks.

## Screens

Landing (`#landing`), Home (`#home`), AI Assistant (`#assistant`), Document Insight (`#documents`), Image Analysis (`#images`), Business Solutions (`#solutions`), and Chat History (`#history`). Each workspace has its own information architecture and interaction model. New Chat resets the current conversation and opens AI Assistant.

## Frontend behavior

- Responsive navigation, global search routing, detailed dialogs, and mobile layouts.
- Three AI Assistant modes with structured, context-aware response patterns.
- Document summary, key point, risk and action views plus validated local file selection.
- Visual reports for infrastructure, screenshots, diagrams, URLs and local image previews.
- Filterable Business Solutions catalog with a three-item comparison workflow.
- Searchable, filterable conversation history stored in browser localStorage.
- Feature-detected WebMCP navigation across every screen.

Live AI, authentication, document parsing, cloud storage connectors and server persistence are not configured. The supplied document and image scenarios are identified as guided content. Files selected from the device are not uploaded.

## Assets and fidelity

The hero uses one generated background derived from the supplied first reference. It recreates the PTCL building, Islamabad mountains and landscaping without baked-in UI. Typography uses Roboto and Caveat from Google Fonts; original font files were not supplied, so exact font identity and pixel equivalence are not claimed. The screenshot example uses the supplied Home reference. Icons and decorative waves are SVG.

Hero generation used the built-in imagegen tool. Prompt: Recreate the reference’s photoreal PTCL building, Islamabad mountains, landscaped grounds and curving roadway as a 16:9 background; building right, pale mint-white mist across left 35%; remove all UI and text except the physical PTCL sign. Saved asset: `dist/assets/hero.png`.

Application source and deployable static assets are in `dist/`. This directory is authored source, not disposable build output. `server.cjs` is a local-only preview server. Sites serves the static directory in production.

## Brand asset

The primary CloudCore AI emblem is `dist/assets/cloudcore-mark.png`, a high-resolution transparent PNG intended for headers, app icons, favicons, avatars, documents, and presentation use. The product wordmark stays as live typography in the frontend so the name and PTCL Smart Cloud endorsement remain perfectly legible at every responsive size.

Image generation used the built-in imagegen tool. Final prompt: Create a premium flat vector-like CloudCore AI symbol from three continuous emerald orbital cloud curves around a lime geometric AI core, with a subtle C in the negative space; transparent background; symbol only; legible at 16px; no text, mockup, shadow, container, watermark, or PTCL logo imitation.
