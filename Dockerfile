FROM node:20-slim

# better-sqlite3 native build fallback (used when no prebuilt binary matches)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p /app/data

EXPOSE 4011

CMD ["node", "src/server.js"]
