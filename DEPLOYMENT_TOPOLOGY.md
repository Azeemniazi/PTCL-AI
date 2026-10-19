# CloudCore AI Deployment & Connection Topology

Last Updated: 2026-10-19 (Asia/Karachi).

## Active Production Setup

CloudCore AI is fully self-hosted on the Linux VM (`59.103.237.42`) behind an Nginx reverse proxy on port 80.

### Service Architecture

| Service / Container | Port | Description | Technology / Model |
| --- | --- | --- | --- |
| **Nginx Web Server** | `80` | Public reverse proxy and static asset edge | Nginx 1.18 (Ubuntu) |
| **CloudCore App / Server** | `4173` | Core Node.js API, Web UI, Auth & Session engine | Node 22 (Express 5, TypeScript) |
| **Qwen3-VL 30B MoE** | `8000` | Multimodal Chat LLM, MOM Generation & Vision OCR | `cloudcore-ai-mom-qwen` (llama.cpp server) |
| **Qwen3-Embedding 4B** | `8001` | Dense Vector Embeddings (2560 dimensions, Flash Attention) | `cloudcore-ai-rag-embed` (llama.cpp server) |
| **Qwen3-Reranker 0.6B** | `8002` | Cross-encoder relevance reranker for RAG candidate scoring | `cloudcore-ai-rag-rerank` (llama.cpp server) |
| **Image Engine (Z-Image)** | `8006` | Text-to-Image and image remix engine | `cloudcore-ai-image-zimage` |
| **Vexa Meeting Gateway** | `8056` | Microsoft Teams bot lifecycle controller | `cloudcore-ai-vexa-1` |
| **Whisper ASR** | `8000 (internal)` | Automated Speech Recognition for meeting audio | `cloudcore-ai-vexa-whisper-1` |
| **PostgreSQL Database** | Supabase Cloud | Relational database with `pgvector` (2560 dims) & `pg_trgm` | PostgreSQL 15+ / 17 |
| **MinIO Object Store** | `9000` | Meeting audio recordings and snapshot storage | `cloudcore-ai-minio-1` |

---

### Request Flow

```text
Browser Client (http://59.103.237.42)
    │
    ▼
Nginx (:80)
    │
    ▼
Node.js App Server (:4173)
    ├── Auth & Sessions (Express + Postgres)
    ├── Knowledge Base Hybrid RAG:
    │     ├── 1. Vector Search via pgvector (2560 dims) + Trigram Search via pg_trgm
    │     ├── 2. Dense Embeddings via Qwen3-Embedding-4B (:8001)
    │     ├── 3. Cross-Encoder Reranking via Qwen3-Reranker-0.6B (:8002)
    │     └── 4. Augmented Generation via Qwen3-VL 30B MoE (:8000)
    ├── Image Studio via Z-Image (:8006)
    └── Meeting Intelligence via Vexa Gateway (:8056) & Whisper
```

---

### Key File Locations on VM

- Application Directory: `/home/ai/frontend`
- Environment Config: `/home/ai/frontend/.env`
- AI Models Directory: `/opt/ai-stack/models`
- AI Stack Compose: `/opt/ai-stack/docker-compose.mom.yml`
- Application Log: `/home/ai/frontend/server.log`
