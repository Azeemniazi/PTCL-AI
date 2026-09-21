# CloudCore AI

A responsive frontend for **CloudCore AI — A product of PTCL Smart Cloud**, closely based on the four supplied design references.

## Run locally

Requires Node.js. No package installation is needed.

```sh
npm start
```

Open http://127.0.0.1:4173. Run `npm run check` for source and interaction-state checks.

## Screens

Landing (`#landing`), Home (`#home`), AI Assistant (`#assistant`), Document Insight (`#documents`), Image Analysis (`#images`), Chat History (`#history`). New Chat resets the current conversation and opens AI Assistant.

## Frontend behavior

- Responsive navigation, search routing, document tabs and dialogs.
- Local document selection, file size/type validation and drag-and-drop.
- Local image previews, image URL loading and example previews.
- Chat UI with explicitly labelled preview responses; conversation history stays in browser localStorage.
- Feature-detected WebMCP screen navigation.

Live AI, authentication, document parsing, cloud storage connectors and server persistence are not configured. The Document Insight analysis is explicitly labelled as an example. Files selected from the device are not uploaded.

## Assets and fidelity

The hero uses one generated background derived from the supplied first reference. It recreates the PTCL building, Islamabad mountains and landscaping without baked-in UI. Typography uses Roboto and Caveat from Google Fonts; original font files were not supplied, so exact font identity and pixel equivalence are not claimed. The screenshot example uses the supplied Home reference. Icons and decorative waves are SVG.

Hero generation used the built-in imagegen tool. Prompt: Recreate the reference’s photoreal PTCL building, Islamabad mountains, landscaped grounds and curving roadway as a 16:9 background; building right, pale mint-white mist across left 35%; remove all UI and text except the physical PTCL sign. Saved asset: `dist/assets/hero.png`.

Application source and deployable static assets are in `dist/`. This directory is authored source, not disposable build output. `server.cjs` is a local-only preview server. Sites serves the static directory in production.
