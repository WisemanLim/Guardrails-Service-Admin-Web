FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --no-fund --no-audit

FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_ADMIN_API_BASE_URL=http://localhost:8084
ENV NEXT_PUBLIC_ADMIN_API_BASE_URL=$NEXT_PUBLIC_ADMIN_API_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3001
CMD ["node", "server.js"]
