# ============================================================================
# SuvidhaPay — Image 1: Dedicated Frontend Container (Multi-stage build)
# ============================================================================

# Stage 1: Build React 19 / Vite Application
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source code and build assets
COPY . ./

# Build arguments for flexible deployment
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

# Run production build (generates /app/dist)
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:1.27-alpine AS runner

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /var/cache/nginx /run /etc/nginx/conf.d /usr/share/nginx/html
USER nginx

# Expose HTTP port
EXPOSE 8080

# Health check to ensure Nginx is serving content
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
