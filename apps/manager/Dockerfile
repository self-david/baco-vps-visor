FROM node:22.14.0-alpine3.21

ENV NODE_ENV=production PORT=3000
WORKDIR /app
RUN apk add --no-cache postgresql17-client
COPY VERSION ./VERSION
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs db.mjs backup-manager.mjs backup-scheduler.mjs diagnostics.mjs update-checker.mjs web-updater.mjs container-metrics.mjs metrics-sampler.mjs metric-alerts.mjs operational-alerts.mjs web-service-alerts.mjs deployment-alerts.mjs ./
COPY public ./public
COPY database ./database
RUN chmod -R a+rX /app/database
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
