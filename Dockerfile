# syntax=docker/dockerfile:1

# --- Etapa 1: Dependencias Completas (Build Tools) ---
FROM node:24.15.0-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
# Instalamos TODO (dev + prod) para poder compilar
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- Etapa 2: Build ---
FROM node:24.15.0-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build del frontend
RUN pnpm build

# --- Etapa 3: Dependencias de Producción (LIMPIEZA) ---
FROM node:24.15.0-bookworm-slim AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
# --prod fuerza a solo instalar "dependencies", ignorando "devDependencies"
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# --- Etapa 4: Runner Final ---
FROM node:24.15.0-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080 

# Uso de APT en lugar de APK para Debian
RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init curl && \
    rm -rf /var/lib/apt/lists/*

# Creación robusta de Usuario en Debian
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs expressjs

# COPIAS CRÍTICAS (Conservando los permisos correctos)
COPY --from=prod-deps --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=expressjs:nodejs /app/server ./server

# Validación
RUN test -f ./dist/index.html

USER expressjs
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl -f http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server/index.mjs"]