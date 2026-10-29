FROM node:22-alpine
WORKDIR /app
COPY . .
RUN mkdir -p /storage && chown node:node /storage
ENV PORT=3000 DATA_DIR=/storage TRUST_PROXY=1
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
USER node
CMD ["node", "server.mjs"]
