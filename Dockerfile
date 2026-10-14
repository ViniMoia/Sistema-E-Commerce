FROM node:22.23.3-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx prisma generate && npx next build --webpack

FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=8080
ARG RELEASE_SHA=unversioned
LABEL org.opencontainers.image.revision=$RELEASE_SHA
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/scripts/cloudrun-consumer.mjs ./scripts/cloudrun-consumer.mjs
USER node
EXPOSE 8080
CMD ["node", "server.js"]
