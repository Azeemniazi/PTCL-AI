# CloudCore Vexa adapter contract

CloudCore uses the self-hosted Apache-2.0 Vexa v0.12 API pinned in `docker-compose.yml`. The source checkout and immutable runtime pins are documented in `vexa-source.md`.

## Launch and stop

CloudCore calls `POST /bots` with the complete allowlisted Teams URL, Teams-safe visible bot name `PTCL AI NOTETAKER`, `recording_enabled: true`, `transcribe_enabled: true`, and automatic-leave limits. Vexa parses both current `/meet/<id>?p=...` and legacy `/l/meetup-join/...` Teams links and returns `native_meeting_id`.

CloudCore stores the normalized engine reference as `teams:<encoded-native-id>`. Stop uses `DELETE /bots/teams/{native_meeting_id}`.

## Live synchronization

Every five seconds CloudCore reads `GET /transcripts/teams/{native_meeting_id}` using its private `bot,tx` scoped token. It maps Vexa lifecycle states as follows:

- `requested` and `joining` → joined
- `awaiting_admission` → lobby
- `active` → recording
- `stopping` → stopping
- `completed` → processing, then MOM generation
- `failed` or `needs_human_help` → failed

Only completed transcript segments are persisted. The database uniqueness key `(meeting_id, start_ms, end_ms, text)` makes polling idempotent.

## Webhook authentication

Vexa's system webhook posts `webhook.v1` envelopes to `POST /internal/vexa/events`. CloudCore verifies `X-Webhook-Signature` as HMAC-SHA256 over `<timestamp>.<raw-body>`, rejects timestamps outside five minutes, and maps meeting IDs through the stored engine reference. `meeting.completed` and `bot.failed` are the primary system events; polling remains the live source of truth.

## Audio and transcription

Vexa records meeting audio to the private MinIO service and transcribes through the pinned local CPU faster-whisper container. CloudCore discovers recording IDs from Vexa, resolves the master raw stream, and proxies it through its authenticated audio endpoint with byte-range headers.

## Snapshot extension

Vexa v0.12 has no supported shared-screen screenshot artifact. The CloudCore snapshot schema and UI remain ready, but no gallery or screen frames are fabricated. A future fork extension must capture only the shared-content region, compare perceptual hashes, retain at most 60 changed 1280×720 JPEG frames, and emit authorized artifact references. It requires a separate live Teams canary because Teams DOM selectors change.
