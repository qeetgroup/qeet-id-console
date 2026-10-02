# Container image for the console (TanStack Start + Nitro node-server).
#
# Production is deployed by Vercel (deploy.yml) and does not use this file. The
# image is built by ci.yml on release/** branches and run by the qeet-id-deploy
# test kit (DEV / TEST / STAGING). Runtime configuration (no rebuild per
# environment):
#   SERVER_URL       backend origin the BFF calls server-to-server
#   SESSION_SECRET   >= 32 chars; seals the __Host-qeet_console session cookie
#   PUBLIC_API_URL   browser-facing API origin (platform/config/api-base-url.ts)
#   PORT / HOST      listen address (defaults 3000 / 0.0.0.0)
# Health: GET /healthz -> 200.

# Dependencies are installed by Bun in its own image (Bun fails to extract
# packages when run inside the Node image under BuildKit).
FROM --platform=$BUILDPLATFORM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS deps
WORKDIR /app
COPY package.json bun.lock .npmrc ./
# Retried: Bun intermittently fails to extract large tarballs (e.g. `next`) on
# some build networks; a lockfile install is idempotent.
RUN for attempt in 1 2 3; do \
      bun install --frozen-lockfile && exit 0; \
      echo "bun install failed (attempt $attempt); retrying" >&2; rm -rf node_modules; sleep 3; \
    done; exit 1

# The build runs once on the build platform: Nitro bundles every dependency into
# .output as plain JavaScript, so the output is architecture-independent. The
# guard below fails the build if a native addon ever appears in it.
FROM --platform=$BUILDPLATFORM node:24.21.0-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN NITRO_PRESET=node-server ./node_modules/.bin/vite build \
 && if find .output -name '*.node' | grep -q .; then \
      echo "native addon in .output; it would be the wrong architecture:" >&2; \
      find .output -name '*.node' >&2; exit 1; \
    fi

FROM node:24.21.0-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6
ARG VERSION=""
ARG REVISION=""
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    QEET_BUILD_VERSION=$VERSION \
    QEET_BUILD_REVISION=$REVISION
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
