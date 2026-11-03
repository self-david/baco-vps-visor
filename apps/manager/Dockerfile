FROM node:22.23.4-alpine3.23 AS frontend-build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY astro.config.mjs ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22.23.4-alpine3.23

ENV NODE_ENV=production PORT=3000
WORKDIR /app
RUN apk add --no-cache postgresql17-client
COPY VERSION ./VERSION
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs db.mjs backup-manager.mjs backup-scheduler.mjs diagnostics.mjs update-checker.mjs web-updater.mjs service-operations.mjs service-task-store.mjs task-queue.mjs gitea-client.mjs gitea-webhooks.mjs project-manager.mjs project-deployment-config.mjs cloudflare-client.mjs container-metrics.mjs metrics-sampler.mjs metric-alerts.mjs operational-alerts.mjs web-service-alerts.mjs deployment-alerts.mjs ./
COPY --from=frontend-build /app/dist ./dist
COPY database ./database
RUN chmod -R a+rX /app/database
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
