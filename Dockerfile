# Stage 1: Build and verification stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY src/ ./src/
COPY tests/ ./tests/

RUN npm test

# Stage 2: Minimal production runtime stage
FROM node:22-alpine AS runtime

WORKDIR /app

RUN addgroup -S sonaraim && adduser -S sonaraim -G sonaraim

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src

USER sonaraim

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "import('./src/config.mjs').then(m => { m.loadAdminConfig(process.env); process.exit(0); }).catch(() => process.exit(1))"

CMD ["node", "src/index.mjs"]
