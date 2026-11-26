FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

USER node

EXPOSE 3000
# La tabla wash_orders se crea sola en la primera consulta.
CMD ["node", "index.js"]
