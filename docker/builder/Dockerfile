# Builder image for Fly.io Machines.
#
# Base: node:20-slim (Debian, NOT Alpine — Tailwind v4 Oxide engine
# requires glibc).
#
# Layout inside the container:
#   /build/             — pre-installed npm deps + base template files
#   /build/server.py    — HTTP build server (binds fly-local-6pn:8080)
#   /build/nsjail.cfg   — sandbox config (no network, RO FS, mem/CPU/PID)
#   /workspace/         — per-build mutable scratch space (mounted RW)
#
# Dispatch model: there is no REST exec endpoint on the Fly Machines API.
# The orchestrator (running in the same Fly org as this app) POSTs the
# project tarball to ``http://{machine_id}.vm.{app}.internal:8080/build``
# over Fly's 6PN private network. The server in this image accepts the
# request, runs nsjail+esbuild, and returns the dist tarball in the
# response. See ``docker/builder/server.py`` for the contract.
FROM node:20-slim

# Install nsjail, tar, and python3 (already part of slim, but pin minimal
# package set explicitly). Avoid curl/wget/git so a successful nsjail
# escape would have nothing useful to chain to.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        nsjail \
        tar \
        gzip \
        coreutils \
        python3-minimal \
    && rm -rf /var/lib/apt/lists/* \
    && (rm -f /usr/bin/curl /usr/bin/wget /usr/bin/git || true)

WORKDIR /build

# Pre-install PWA build dependencies so the per-build cost is just esbuild,
# not "npm install + esbuild".
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Base template files: esbuild config, tailwind config, service worker,
# manifest template, index.html template.
COPY base/ ./base/

# Sandbox config + HTTP build server.
COPY nsjail.cfg ./nsjail.cfg
COPY server.py  ./server.py
RUN chmod +x ./server.py

# Per-build scratch directory. Each request unpacks the incoming project
# here, runs nsjail with /workspace as cwd (RW), and wipes it again.
# Owned by the `node` user (uid 1000, shipped with node:20-slim).
RUN mkdir -p /workspace \
    && chown -R node:node /workspace /build

USER node

# Listen on port 8080. Fly's 6PN DNS makes this reachable at
# http://{machine_id}.vm.{app_name}.internal:8080 from inside the org.
EXPOSE 8080

# Minimal TCP-level healthcheck using Node (no curl in the image — we
# deliberately stripped it). Matches the server's bind port.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('net').connect(8080,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" || exit 1

ENTRYPOINT ["python3", "/build/server.py"]
