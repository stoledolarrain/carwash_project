FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Primero solo las dependencias: Docker reutiliza esta capa mientras package*.json no cambie.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Sin privilegios de root dentro del contenedor.
USER node

EXPOSE 3001
# Al arrancar aplica las migraciones pendientes y crea el administrador inicial si no hay usuarios.
CMD ["node", "index.js"]
