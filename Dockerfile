FROM node:20-alpine

WORKDIR /app

# Copia manifesto de dependências primeiro para aproveitar cache de layers
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

CMD ["node", "index.js"]
