# CloudCore Vexa source pin

The local self-hosted source checkout lives at `vendor/cloudcore-vexa` and is intentionally ignored by the parent repository so its nested Git history is not copied accidentally.

- Upstream: `https://github.com/Vexa-ai/vexa.git`
- Apache-2.0
- Commit: `dba990b413bd0f888b02d46a24f802db492addbb`
- Runtime image: `vexaai/vexa-lite:v012@sha256:945628e54d843cf6286a823ca8e226f2b3c48eb948ad2f895e64eb867b7a0d55`
- CPU transcription image: `fedirz/faster-whisper-server:latest-cpu@sha256:760e5e43d427dc6cfbbc4731934b908b7de9c7e6d5309c6a1f0c8c923a5b6030`

All Docker image layers, volumes, model files, PostgreSQL data, MinIO data, and the checkout are stored on the D drive on this pilot host.
