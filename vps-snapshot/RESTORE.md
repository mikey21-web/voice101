# Restore this stack on a new VPS

Snapshot of `160.250.204.162` (deploysafe.in), captured 2026-08-02.
Everything below is what the old VPS had. Follow in order.

## 0. What was where

| Path on old VPS | Source | Restore from |
|---|---|---|
| `/opt/lead-automation-demo` | git `mikey21-web/vritual-assistant` branch `single-tenant-arch` @ `502e124` | clone |
| `/root/virtual-assistant` | git `mikey21-web/vritual-assistant` branch `master` @ `dc2799c` | clone |
| `/opt/OpenWA` | git `rmyndharis/OpenWA` @ `1109ea7` (clean) | clone |
| `/opt/prema-voice-agent` | **no git anywhere** | `code/prema-voice-agent/` |

Ports in use: backend `4002`, dashboard `4001`, tour-proxy `4010`, dograh-api `8010`, dograh-ui `3010`, minio `9000`, n8n `5678`, hermes-dashboard `9119`.

## 1. Prereqs on the new box

```bash
apt update && apt install -y docker.io docker-compose-plugin caddy git python3.11 python3.11-venv
```

## 2. Clone the code

```bash
git clone https://github.com/mikey21-web/vritual-assistant.git /opt/lead-automation-demo
cd /opt/lead-automation-demo && git checkout single-tenant-arch

git clone https://github.com/mikey21-web/vritual-assistant.git /root/virtual-assistant
cd /root/virtual-assistant && git checkout master

git clone https://github.com/rmyndharis/OpenWA.git /opt/OpenWA
```

## 3. Restore the code that is in no repo

```bash
# Prema voice agent (LiveKit worker)
cp -r code/prema-voice-agent /opt/prema-voice-agent
cd /opt/prema-voice-agent
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Files that were untracked on the old box
cp code/virtual-assistant-untracked/docker-compose.override.yml /root/virtual-assistant/
cp -r code/virtual-assistant-untracked/backend/prisma/migrations/20260729120000_add_workflow_tables \
      /root/virtual-assistant/backend/prisma/migrations/
```

## 4. Drop in the env files

```bash
cp system/envs/lead-automation-demo.env    /opt/lead-automation-demo/.env
cp system/envs/deploy-demo.env.realestate  /opt/lead-automation-demo/deploy-demo/.env.realestate
cp system/envs/virtual-assistant.env       /root/virtual-assistant/.env
cp system/envs/dograh.env                  /root/virtual-assistant/dograh/.env
cp system/envs/prema-voice-agent.env       /opt/prema-voice-agent/.env
```

`deploy-demo/.env.realestate` is tracked in git but had `DOGRAH_API_KEY` added by hand on the server. The copy above already contains it. See `code/env.realestate.diff`.

Update these to the new host/domain before starting anything:
`PUBLIC_URL`, `CORS_ORIGIN`, `PUBLIC_BASE_URL`, `PUBLIC_HOST`, `MINIO_PUBLIC_ENDPOINT`, `N8N_WEBHOOK_URL`.

## 5. Start the stacks

```bash
# demo-realestate (backend, dashboard, agent-service, postgres, redis)
cd /opt/lead-automation-demo
docker compose -f docker-compose.demo.yml -p demo-realestate --env-file deploy-demo/.env.realestate up -d --build

# dograh
cd /root/virtual-assistant/dograh
docker compose -p dograh up -d
```

The dashboard bakes `VITE_API_URL=/api` at **build** time. Rebuild the dashboard image if the API path changes.

## 6. Restore the data

```bash
gunzip -c db/demo-realestate-pgdumpall.sql.gz | docker exec -i demo-realestate-postgres-1 psql -U postgres
gunzip -c db/dograh-pgdumpall.sql.gz        | docker exec -i dograh-postgres-1 psql -U postgres

docker run --rm -v demo-realestate_uploads:/v -v "$PWD/volumes":/in alpine \
  tar xzf /in/demo-realestate_uploads.tar.gz -C /v
docker run --rm -v dograh_minio-data:/v -v "$PWD/volumes":/in alpine \
  tar xzf /in/dograh_minio-data.tar.gz -C /v
```

Main DB is `lead_automation`. Then apply migrations:
```bash
docker exec demo-realestate-backend-1 npx prisma migrate deploy
```

## 7. Prema voice agent as a service

```bash
cp system/systemd/prema-voice-agent.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now prema-voice-agent
journalctl -u prema-voice-agent -f
```

Prema needs live LiveKit + Vobiz SIP credentials (`LIVEKIT_URL`, `SIP_TRUNK_ID`, `VOBIZ_*`). The SIP trunk is registered to the old IP if it was IP-whitelisted — re-register with the new IP via `setup_trunk.py`.

## 8. Caddy

```bash
cp system/caddy/Caddyfile /etc/caddy/Caddyfile
# edit domains, then:
systemctl reload caddy
```

`/etc/caddy/Caddyfile` imports `/opt/lead-automation-demo/deploy-demo/Caddyfile.additions`, which serves `realestate.deploysafe.in`. Point DNS at the new IP **before** reloading, or TLS issuance fails.

## 9. Not restored on purpose

- `hermes-gateway` / `hermes-dashboard` — third-party agent tooling, not part of this product. Units are in `system/systemd/` if you want them.
- `strix-worker`, `tour-proxy` — started by hand, no compose file. Recreate from `docker/manual-containers.json`. tour-proxy builds from `/opt/lead-automation-demo/tour-proxy`.
- `/opt/lead-automation.RETIRED_*` — retired copies, dead.
- khoj / n8n / moonshine volumes — present on the old box but no running container.

## 10. Why the old VPS was struggling

Disk was at 86–90% of 99G. `/var/lib/docker` alone was 7.7G, plus 2.3G of retired checkouts and 3.9G of duplicated repo trees (`.git` was 874M + 1.4G). Give the new box room, or prune.
