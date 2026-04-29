# syntax=docker/dockerfile:1

# --- Dependencies layer (cached if package.json unchanged) ---
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- Build layer ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma client must be generated before the Next build so Type-Check passes.
RUN npx prisma generate
RUN npm run build

# --- Runtime layer (standalone output) ---
FROM node:24-alpine AS runner
WORKDIR /app

# tini is a proper PID 1 so SIGTERM reaches Node. openssl is required by Prisma.
RUN apk add --no-cache tini openssl

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Europe/Berlin

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Next.js standalone output — self-contained server bundle
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma needs schema + migrations at runtime to run `migrate deploy` on start
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Entrypoint runs migrations, then starts the server. Idempotent.
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
