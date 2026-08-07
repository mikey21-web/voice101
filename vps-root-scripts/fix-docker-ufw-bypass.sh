#!/usr/bin/env bash
set -euo pipefail

# Docker writes its own iptables rules ahead of ufw's INPUT chain, so ufw's
# "deny incoming" default never actually applies to `docker run -p` /
# compose `ports:` publishes. This inserts explicit rules into the
# DOCKER-USER chain (which Docker guarantees is consulted first for all
# forwarded/published-port traffic) to close that gap for the ports that
# should only be reachable from Caddy (host-local, unaffected by this) or
# from other containers (docker bridge subnets, also unaffected).
#
# Safe by construction: RELATED/ESTABLISHED and docker-subnet traffic are
# accepted before any DROP rule, and a final RETURN preserves whatever
# other DOCKER-USER behavior existed before this script ran.

PORTS=(3000 3001 3010 8000 8002 8010 8123 9000 5433 4001 4011 4021 4041)

echo "[*] Flushing DOCKER-USER chain..."
iptables -F DOCKER-USER

echo "[*] Allow established/related..."
iptables -A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT

echo "[*] Allow all docker bridge subnets (172.16.0.0/12) — cross-container/compose-project traffic..."
iptables -A DOCKER-USER -s 172.16.0.0/12 -j ACCEPT

echo "[*] Allow loopback..."
iptables -A DOCKER-USER -i lo -j ACCEPT

for p in "${PORTS[@]}"; do
  echo "[*] Blocking public access to port $p..."
  iptables -A DOCKER-USER -p tcp --dport "$p" -j DROP
done

echo "[*] Restoring default passthrough for anything else..."
iptables -A DOCKER-USER -j RETURN

echo "[*] Installing iptables-persistent so this survives reboot..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent
netfilter-persistent save

echo "[✓] Done. DOCKER-USER chain:"
iptables -L DOCKER-USER -n --line-numbers
