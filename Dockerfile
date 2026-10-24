# Console image (Nitro node-server) for the Qeet ID Kit (qeet-id-kit); production runs on Vercel.
# Runtime configuration:
#   SERVER_URL       backend origin the BFF calls
#   SESSION_SECRET   at least 32 characters; seals the session cookie
#   PUBLIC_API_URL   browser-facing API origin
#   PORT / HOST      listen address (default 3000 / 0.0.0.0)

# Bun installs in its own image: it fails to extract packages inside the Node image.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.3@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598 AS deps
WORKDIR /app
COPY package.json bun.lock .npmrc ./
# Retried: Bun sometimes fails to extract large tarballs; a lockfile install is idempotent.
RUN for attempt in 1 2 3; do \
      bun install --frozen-lockfile && exit 0; \
      echo "bun install failed (attempt $attempt); retrying" >&2; rm -rf node_modules; sleep 3; \
    done; exit 1

# Built once on the build platform: .output is plain JavaScript, so it runs on any
# architecture. The guard fails the build if a native addon appears.
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
# Unhealthy when the production configuration is invalid (every request fails).
# The slim image has no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
