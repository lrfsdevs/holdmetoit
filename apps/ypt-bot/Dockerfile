FROM node:22-bookworm-slim

# pg_dump/pg_restore must match the Supabase PostgreSQL major version.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      gnupg \
      openssl \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-17 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm ci \
 && npm run db:generate -w @holdmetoit/database \
 && npm run build -w @holdmetoit/database

ENV NODE_ENV=production

CMD ["npm", "start", "-w", "@holdmetoit/ypt-bot"]
