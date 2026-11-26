FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

USER node

EXPOSE 3002
# Catalog no migra solo al arrancar: primero aplica migrations/*.sql (idempotente) y luego inicia
# el servidor HTTP junto con el OutboxWorker que publica en Kafka.
CMD ["sh", "-c", "node src/infrastructure/database/migrate.js && node index.js"]
