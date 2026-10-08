# CloudCore AI deployment and connection map

Last documented: 2026-10-05 (Asia/Karachi). This describes the **current development setup**, not a public production deployment. Service health should be rechecked after restarts.

## Where things run

| Location | Components | Role |
| --- | --- | --- |
| Windows development laptop (`D:\CHATBOT SMART`) | CloudCore `app`, `worker`, PostgreSQL, Redis, and MinIO in Docker Desktop | Runs the CloudCore web UI, API, background jobs, and local application data. |
| Linux VMware VM (`ai`, Ubuntu 22.04, private IP `192.168.100.10`) | CloudCore Vexa fork, Vexa PostgreSQL, Vexa Whisper CPU, and MinIO in Docker Compose | Joins Teams meetings and runs the meeting-engine/transcription side. |
| Linux VM (`/opt/ai-stack`) | CPU-model files | A separate AI-model project. A model file download is not a running inference service. |

The VM has been reached from outside at public IP `59.103.237.42` through SSH port `20484`, which is forwarded to SSH port 22 on its private address. The VMware **VDC name is unknown**: the guest hostname is `ai`, and `vmtoolsd --cmd "info-get guestinfo.vcd.orgvdc.name"` returned `No value found`.

## Current Meetings AI connection

```text
Browser on laptop
    -> CloudCore app in Docker Desktop
    -> host.docker.internal:18056 (from the app container)
    -> 127.0.0.1:18056 on the Windows laptop
    -> encrypted SSH local-forward connection to 59.103.237.42:20484
    -> 127.0.0.1:8056 on the Linux VM
    -> Vexa gateway -> meeting engine / Teams bot
```

The laptop-to-VM tunnel forwards **one local port**; it does not move CloudCore to the VM, expose Vexa as a public API, or automatically provide a reverse VM-to-laptop connection. The tunnel is needed only while the laptop-based CloudCore app is using the VM's Vexa service. Vexa itself keeps running if the tunnel closes, but the laptop app loses that connection.

On the VM, Vexa's gateway port `8056` and its `3001` and `8100` ports were bound to `127.0.0.1`, not to the public network. The Vexa stack uses internal Docker networking for its PostgreSQL, Whisper, and MinIO services. The earlier proposed `vexa.59.103.237.42.sslip.io` HTTPS hostname is **not confirmed as deployed or reachable**; do not treat it as the active integration endpoint.

## Start the SSH tunnel

Run this in **Windows PowerShell on the laptop**, not in the MobaXterm VM shell:

```powershell
ssh -i "C:\Users\azeem\.ssh\id_ed25519" -p 20484 -N -L 127.0.0.1:18056:127.0.0.1:8056 ai@59.103.237.42
```

Keep that PowerShell window open. `-L` connects the laptop's loopback port `18056` to the VM's loopback port `8056`; `-N` requests forwarding without opening a remote shell. If the command exits, the tunnel is gone. If it reports that port `18056` is already in use, check whether a tunnel is already running before starting another.

In a **second Windows PowerShell window**, test the tunnel:

```powershell
curl.exe http://127.0.0.1:18056/health
```

Expected response when Vexa and the tunnel are healthy: `{"status":"ok","service":"gateway"}`. This test does not by itself prove the Teams bot or transcription pipeline is healthy.

## Check Vexa on the VM

Run these in **MobaXterm's Linux SSH terminal**:

```bash
cd /opt/cloudcore-meetings
docker compose --env-file .env -f docker-compose.cloud.yml ps
curl -fsS http://127.0.0.1:8056/health
docker compose --env-file .env -f docker-compose.cloud.yml exec -T vexa supervisorctl status
```

The Compose project and `.env` live on the VM. Do not paste `.env`, API tokens, passwords, or SSH private keys into chat or documentation. The gateway health check was previously successful, and `vexa:meeting-api` was previously confirmed `RUNNING` after a configuration fix; these are historical checks, not a claim that the services are healthy at this moment.

## Check CloudCore on the laptop

Run this in **Windows PowerShell** from the project directory after Docker Desktop has started:

```powershell
Set-Location "D:\CHATBOT SMART"
docker compose ps app worker postgres redis minio
```

The app and worker must be running for the local Meetings AI workflow. Docker Desktop on the laptop is still required for these CloudCore services even though the heavy Vexa meeting engine has moved to the VM. The old local Vexa and Whisper images were removed to free laptop disk space; that does not affect the VM's copies.

## CPU AI model project is separate

`/opt/ai-stack/models/main` on the VM is the planned location for Qwen GGUF files. The `mmproj-Qwen3VL-30B-A3B-Instruct-Q8_0.gguf` vision-projector file was reported downloaded, but the larger `Qwen3VL-30B-A3B-Instruct-Q4_K_M.gguf` download failed before completion during the last reported attempt. No CPU LLM API is documented here as deployed or connected to CloudCore. Vexa's existing Whisper CPU container is a separate transcription service.

## Security and operational boundaries

- SSH encrypts the laptop-to-VM forwarding. Only the local laptop loopback endpoint should be used for the current tunnel.
- Do not open Vexa port `8056` directly to the internet or substitute the unverified HTTPS hostname without authentication, TLS, and an explicit deployment plan.
- Keep `.env` and the SSH private key out of Git and shared documentation. This file intentionally contains no credentials.
- If the laptop is off, Docker Desktop is stopped, or the tunnel window closes, the laptop-hosted CloudCore app is unavailable or disconnected from Vexa. The VM-side Vexa containers may continue running independently.
- The tunnel forwards laptop-to-VM traffic only. Any webhook or callback from Vexa on the VM back to the laptop needs a separately verified path; this document does not assume one exists.

## Future target (not current state)

A later deployment can move CloudCore itself to a server and connect it to Vexa over an authenticated private network or a secured HTTPS API. At that point the laptop SSH tunnel would no longer be needed for ordinary use. Do not switch the local app configuration to a public URL until that endpoint is actually deployed and tested.
