# ============================================================================
# SuvidhaPay — Image 2: Dedicated Backend Container
# Node.js 22 + Express + PostgreSQL Migrations & Repositories
# ============================================================================

FROM node:22-alpine

# Install curl for container health check probes
RUN apk add --no-cache curl

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --ignore-scripts

# Copy application source, migrations, and configurations
COPY . ./

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_ENGINE=POSTGRES

# Ensure proper permissions for non-root 'node' user
RUN mkdir -p /app/data && chown -R node:node /app

# Run as non-root user for security hardening
USER node

# Expose backend port
EXPOSE 3000

# Health check probe against Express /health/live endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD curl -f http://127.0.0.1:3000/api/v1/health/live || exit 1

# Start production server (applies migrations and initializes database on startup)
CMD ["npx", "tsx", "src/server.ts"]
