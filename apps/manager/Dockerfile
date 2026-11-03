FROM node:22.14.0-alpine3.21

ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY server.mjs ./server.mjs
COPY public ./public
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
