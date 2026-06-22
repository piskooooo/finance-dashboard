FROM node:20-alpine

WORKDIR /app

LABEL org.opencontainers.image.title="Finance Dashboard"
LABEL org.opencontainers.image.description="Self-hosted dashboard for manually tracked finances."

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN apk add --no-cache libcap su-exec \
  && mkdir -p /app/data \
  && chown -R node:node /app \
  && chmod +x /usr/local/bin/docker-entrypoint.sh \
  && setcap 'cap_net_bind_service=+ep' /usr/local/bin/node

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV PUID=1000
ENV PGID=1000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
