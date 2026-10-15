# Image Studio

The studio uses the existing vanilla JavaScript application shell. State and draft helpers, templates, the controller, and scoped CSS live in the `dist/studio-*` files and `dist/studio.css`. The TypeScript image adapter is separate from the HTTP routes. No database migration is required. Existing manifests and jobs remain readable; records without an operation are ordinary generation.

## Workflows

- Create and Remix maintain separate drafts for this signed-in browser session. Previewing history does not replace the draft; **Reuse settings** does.
- Prompt enhancement can be undone, is bounded to 500 characters, and cannot replace edits made while the request was running.
- Gallery selection supports individual/bulk save and permanent deletion with confirmation. Failed items remain selected; retry only includes failures.
- Analyze supports uploads, generated assets, examples, and public HTTPS image URLs. Reports explicitly identify visual analysis versus metadata-only inspection. URL import preserves the application CSP and blocks private/local destinations, credentials, non-HTTPS URLs, custom ports, excessive redirects, and oversized/invalid images. IPv4 public destinations are supported; IPv6-only sources require an upload.
- Jobs reconnect after navigation, returning to the browser, or refresh. Polling is sequential and backs off after transient failures. Cancellation discards the result even when the inference engine cannot stop computing immediately.

## API additions

`GET /api/images/capabilities` requires authentication and returns model identity, generation availability, `remixSupported`, `remixVerified`, `remix`, supported controls, and explanatory messages. Read-only discovery is cached for 15 seconds. Fixed turbo steps/guidance are not exposed as editable controls.

`POST /api/images/remix` requires multipart form data containing `prompt` (1–500 characters), `style`, `aspectRatio`, optional `negativePrompt` and positive integer `seed`, and exactly one of `sourceAssetId` or an `image` file. `strength` defaults to 0.65 and accepts 0.1–0.9. JPG, PNG and WEBP uploads are limited to 20 MB and 40 megapixels; authorized generated SVG references are rasterized before inference. Normalized reference files stay outside the served generated-assets directory and are removed after execution/cancellation. The response uses the existing `202 {status,job}` job envelope.

The adapter sends reference bytes as `init_images` and strength as `denoising_strength` to `/sdapi/v1/img2img`. It never falls back to text-to-image or vector generation. Results preserve provenance (`operation`, `sourceAssetId`/`sourceName`, `strength`). Each actor may have one active image job. Job status now includes `cancelled`.

`POST /api/images/import-url` accepts JSON `{url}` and returns a validated PNG for analysis, or a JSON error. It requires authentication and has a separate 20-requests/minute rate limit. DNS resolution is pinned for each request and checked again at redirects.

`POST /api/vision` adds `analysisKind: "visual" | "metadata"` to identify what the report actually represents. Downloads and saves enforce source-asset ownership/privileged access. Save filenames use the asset's actual extension; folder visibility and sharing must agree.

## Live remix release gate

Set `IMAGE_ENGINE_URL` to the existing sdapi-compatible image engine. Leave `IMAGE_REMIX_VERIFIED=false` until the deployed model has passed the real image canary:

```sh
npm run studio:canary
```

This creates two distinct references, two same-seed repeats for the first reference, and a same-seed output from the second reference. Results and a reference-sensitivity report are written to `artifacts/studio-remix-canary`. The script checks repeat stability and reference influence; a person must also review the outputs for meaningful retained structure and the requested edit. Set the flag to `true` and restart the app only after this passes. Repeat verification whenever the engine, model, or adapter changes. Unit tests and mock inference do **not** satisfy this gate.

The local default engine at `127.0.0.1:8006` was unavailable during implementation, so live inference and the canary have not been verified. The shipped adapter and API were tested against an isolated HTTP fixture; Remix remains disabled by default.

## Verification and visual review

```sh
npm run check
npm run studio:preview
```

The preview is loopback-only at `http://127.0.0.1:4173/#images` and clearly identifies itself as an isolated visual fixture. It uses existing example assets and cannot mutate application data. Add `-- --empty` for the empty-library version, or set `STUDIO_PREVIEW_PORT` if the application already uses port 4173.

Automated tests cover independent drafts, explicit reuse, duplicate button/keyboard submission, enhancement undo and stale responses, cancellation races, incremental gallery search, partial deletion, file validation, capability gating, reference forwarding, permissions, output format preservation, cancellation cleanup, and analysis provenance.

Rendered browser review was blocked by the computer-use environment's inability to establish the browser URL. **Desktop/mobile screenshots, 1440×900 first-fold acceptance, 320px reflow, mobile keyboard behavior, and visual accessibility verification remain outstanding.** Check populated and empty Create/Gallery/Analyze/Remix views, menus, save dialogs, viewer zoom, error/reconnection states, keyboard navigation, reduced motion, and regression behavior in the other products before deployment.
