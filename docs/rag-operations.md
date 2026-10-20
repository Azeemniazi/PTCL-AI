# Knowledge retrieval operations

The Knowledge Hub is the persistent source collection used by `/api/chat` when
`use_rag` is enabled. Access is restricted to documents owned by the user or
shared in the workspace. `rag_scope` can restrict a request to a document or a
folder tree.

## Runtime contracts

- Node.js 22 or later; run `npm run check` before releasing changes.
- Poppler `pdftotext`, `pdfinfo` and `pdftoppm` must be on the application host's
  PATH. Raw PDF font streams are not an extraction fallback.
- The deployed answer model has an 8,192-token context. The application counts
  its chat template with the model's tokenizer where supported and reserves
  space for the answer and grounding review.
- The embedding contract is 2,560 finite dimensions with a nonzero norm.
  Changing embedding models requires rebuilding all stored vectors; equal
  dimensions alone do not establish compatibility.
- Configure the answer, embedding and reranker endpoints through the existing
  `AI_BASE_URL`, `EMBEDDING_API_URL` and `RERANKER_API_URL` settings.

## Ingestion and recovery

An upload saves its original and an `indexing` record before acknowledging the
request. Extraction/OCR and embeddings run in a serialized background queue.
Only `ready` documents can supply evidence. An unreadable page, truncated OCR
or failed embedding produces `failed` status rather than a partial ready index.
PDF OCR has an explicit 50-page limit; larger scanned files require a reviewed
limit/configuration change or smaller source files.

The Knowledge Hub refreshes processing status. Owners and administrators can
use **Retry processing**, which calls
`POST /api/knowledge/documents/:id/reindex`. Pending records resume after an
app restart. Index replacement uses a database transaction, preserving the old
chunks if replacement fails. Pending/failed sources are excluded from answers.

For legacy extraction or chunk repair, on the application host:

```sh
node --env-file=.env scripts/repair-knowledge-index.mjs --check
node --env-file=.env scripts/repair-knowledge-index.mjs --apply
```

Check mode does not change database rows; it may use OCR to inspect a page that
has no adequate digital text. Apply mode makes private source/chunk snapshots
under `data/rag-backups/` before changing anything. It skips identical valid
indexes and replaces each changed document's source text and chunks together.
It refuses to overwrite a source changed concurrently. Originals remain on the
host. Treat these backups as private knowledge data.

This repair command is intended for source/chunk reconciliation. An embedding
model migration needs an intentional complete-vector rebuild, including sources
whose extracted text has not changed.

## Answer behavior

Certificate fields, stated-date comparisons and inventories use source-derived
values. Responsibility tables, qualified features, availability/support terms
and standard service overviews retain original wording. These paths do not
invent commitments from placeholders or transfer an exception to unrelated
responsibility rows.

Other questions use authorized hybrid retrieval, bounded reranking, explicit
source IDs, a measured context budget and generation with a grounding review.
An invalid citation, unsupported percentage, incomplete output or failed review
cannot be published as a checked answer. Valid arithmetic is derived from
explicit source rates and whole intervals. Missing facts produce a qualified
absence statement or refusal.

Source IDs link to authenticated originals. They establish document-level
provenance; retrieval scores are not confidence percentages. RAG SSE responses
are buffered until checks finish. This increases the time to the first visible
answer on the current CPU-hosted model.

## Verification and source governance

Use live questions in addition to the code suite. Check exact values, requested
list coverage, qualifications, selected entities, unsupported additions and
answer structure against complete source documents. Preserve failed attempts
and transport errors when recording corrective retests.

Source placeholders and conflicting clauses remain source issues. Quote or
disclose them rather than silently resolving them. A certificate filename does
not override its body, and a stated validity period does not prove an external
issuer status or an unprovided renewal. Finite evaluation results do not prove
zero errors for unseen questions or documents.
