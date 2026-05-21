# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Audit 4 — Next.js bakea NEXT_PUBLIC_* en build time. La build var del
# original (NEXT_PUBLIC_API_URL) no coincidía con la que lee page.tsx
# (NEXT_PUBLIC_API_BASE_URL); además faltaba NEXT_PUBLIC_ADAPTER_URL.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
ARG NEXT_PUBLIC_ADAPTER_URL=http://localhost:9002
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_ADAPTER_URL=$NEXT_PUBLIC_ADAPTER_URL
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

COPY package*.json ./
RUN npm install

COPY . .
# Audit 4 — Next.js standalone copia /public; el repo aún no tiene esta
# carpeta así que la creamos vacía para evitar fallo en docker build.
RUN mkdir -p public && npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3002

CMD ["node", "server.js"]
