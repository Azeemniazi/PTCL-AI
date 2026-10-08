# CloudCore AI

A responsive CloudCore AI workspace with a self-hosted Microsoft Teams meeting-notetaker control plane.

## Run locally

Requires Node.js 22. Development mode uses an in-memory repository and a mock meeting engine when service URLs are absent.

```sh
npm install
npm run build
npm start
```

Open http://127.0.0.1:4173. Run `npm run check` for source and interaction-state checks.

## Screens

The public site includes Landing (`#landing`), Solutions (`#site-solutions`), AI Assistant overview (`#site-ai`), Industries (`#site-industries`), Resources (`#site-resources`), and About (`#site-about`). The signed-in workspace includes Home (`#home`), AI Assistant (`#assistant`), Meetings AI (`#meetings`), Document Insight (`#documents`), Image Analysis (`#images`), and Chat History (`#history`).

## Frontend behavior

- Responsive navigation, search routing, document tabs and dialogs.
- Local document selection, file size/type validation and drag-and-drop.
- Local image previews, image URL loading and example previews.
- Chat UI with explicitly labelled preview responses; conversation history stays in browser localStorage.
- Feature-detected WebMCP screen navigation.
- Teams-link validation, guest-bot launch, meeting status, transcript, snapshots, private audio, editable MOM, Markdown export and print/PDF.

Meetings AI has real backend interfaces for Entra authentication, PostgreSQL, Redis, MinIO, the CloudCore Vexa fork and an OpenAI-compatible internal AI service. Document Insight and Image Analysis remain frontend previews.

## Meetings AI deployment

Docker Desktop's Linux data disk must be placed on the D drive before the first image pull. On this pilot host it is configured at `D:\docker\wsl\DockerDesktopWSL`. Generate local secrets, start the pinned self-hosted stack, then provision CloudCore's scoped Vexa token:

```sh
node scripts/bootstrap-local.mjs
docker compose --env-file .env up -d vexa
node scripts/bootstrap-vexa.mjs
docker compose --env-file .env up -d --build
```

Open `http://127.0.0.2:4173/#meetings`. The default local authentication mode creates a pilot administrator. Production startup requires Entra, database, Redis, Vexa, and encryption settings. AI credentials are optional: when absent, local Whisper supplies the transcript and CloudCore produces extractive MOM locally.

The pinned Vexa Lite image runs the visible Teams browser bot, records audio, and sends audio to the pinned CPU faster-whisper service. CloudCore polls Vexa every five seconds for lifecycle and completed transcript segments, proxies authorized recordings, and uses signed completion/failure webhooks. The pilot permits two active meetings and retains content for 30 days.

Upstream Vexa does not currently expose shared-screen snapshots. The Snapshots tab is retained for the planned `cloudcore-vexa` screen-share extension; it remains empty until that extension is built and canary-tested. See [the deployed adapter contract](docs/vexa-contract.md).

## Assets and fidelity

The hero uses one generated background derived from the supplied first reference. It recreates the PTCL building, Islamabad mountains and landscaping without baked-in UI. Typography uses Roboto and Caveat from Google Fonts; original font files were not supplied, so exact font identity and pixel equivalence are not claimed. The screenshot example uses the supplied Home reference. Icons and decorative waves are SVG.

Hero generation used the built-in imagegen tool. Prompt: Recreate the reference’s photoreal PTCL building, Islamabad mountains, landscaped grounds and curving roadway as a 16:9 background; building right, pale mint-white mist across left 35%; remove all UI and text except the physical PTCL sign. Saved asset: `dist/assets/hero.png`.

Frontend source and deployable assets are in `dist/`; this directory is authored source. The TypeScript service is in `src/` and compiles to `build/`. `server.cjs` remains a static preview only; the functional deployment uses `build/server.js` or Docker Compose.

## Brand asset

The primary CloudCore AI emblem is `dist/assets/cloudcore-mark.png`, a high-resolution transparent PNG intended for headers, app icons, favicons, avatars, documents, and presentation use. The product wordmark stays as live typography in the frontend so the name and PTCL Smart Cloud endorsement remain perfectly legible at every responsive size.

Image generation used the built-in imagegen tool. Final prompt: Create a premium flat vector-like CloudCore AI symbol from three continuous emerald orbital cloud curves around a lime geometric AI core, with a subtle C in the negative space; transparent background; symbol only; legible at 16px; no text, mockup, shadow, container, watermark, or PTCL logo imitation.
