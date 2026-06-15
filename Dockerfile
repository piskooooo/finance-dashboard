FROM node:20-alpine

WORKDIR /app

LABEL org.opencontainers.image.title="Finance Dashboard"
LABEL org.opencontainers.image.description="Self-hosted dashboard for manually tracked stock holdings."

COPY --chown=node:node package.json server.js ./
COPY --chown=node:node public ./public
RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATA_DIR=/app/data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "server.js"]
