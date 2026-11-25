# CloudCore production snapshot

Captured November 25, 2026 from the CloudCore VM. GitHub main and the live
checkout report baseline commit 77cb6e3. Later updates were applied on the VM.

- **dist** contains the HTML verified against the live HTTP response, the
  active React bundle, styles, and public assets.
- **src** contains the application sources from the VM checkout.
- **runtime-js** records the deployed compiled JavaScript files on disk.
  The VM source and compiled files were deployed separately.
- **migrations**, **scripts**, and the dependency manifests are the related
  app files from the VM checkout.
- **SHA256SUMS** records the captured file hashes.

This is a release record. A deployable source release still needs to
reconcile the VM sources and generated assets. Private environment files,
operational data, logs, and optional scan-engine files are outside this
snapshot. Unpublished workspace changes remain in the workspace.
