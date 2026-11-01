FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm ci \
 && npm run db:generate -w @holdmetoit/database \
 && npm run build -w @holdmetoit/database \
 && npm run build -w @holdmetoit/discord

ENV NODE_ENV=production

CMD ["npm", "start", "-w", "@holdmetoit/tasker"]
