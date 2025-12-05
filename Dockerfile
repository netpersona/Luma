# Multi-stage Dockerfile for Luma - E-Reader & Audiobook Player
# Build optimized production image for Unraid deployment

# Stage 1: Build the application
# Use Node 22 for full import.meta.dirname support
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy application source
COPY . .

# Debug: Verify client files are present (remove after confirming build works)
RUN echo "=== Verifying client files ===" && \
    ls -la client/ && \
    ls -la client/src/ && \
    test -f client/src/main.tsx && echo "✓ main.tsx found" || (echo "✗ main.tsx MISSING" && exit 1)

# Build the application
# - vite build creates dist/public/ with frontend assets
# - esbuild bundles server code to dist/index.js
RUN npm run build

# Verify build artifacts exist
RUN ls -la dist/ && \
    test -f dist/index.js && \
    test -d dist/public && \
    echo "Build artifacts verified successfully"

# Stage 2: Production runtime
FROM node:22-alpine AS runtime

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    ttf-dejavu \
    fontconfig

# Create app user for security (use different GID/UID to avoid conflicts)
RUN addgroup -g 1001 luma && \
    adduser -D -u 1001 -G luma luma

# Copy package files
COPY package*.json ./

# Copy node_modules from builder (includes vite which is needed for server imports)
# This is larger than --omit=dev but required because server/vite.ts has static vite imports
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder
# dist/ contains: index.js (bundled server) and public/ (frontend assets)
COPY --from=builder /app/dist ./dist

# Copy shared schema (needed for runtime type imports)
COPY --from=builder /app/shared ./shared

# Create directories for user data with proper permissions
# /data stores everything: database, books, audiobooks, covers, and uploads
RUN mkdir -p /data/books /data/audiobooks /data/covers /data/uploads && \
    chown -R luma:luma /app /data

# Switch to non-root user
USER luma

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Environment defaults
# DATA_DIR: Location for SQLite database and all data files
ENV NODE_ENV=production \
    PORT=5000 \
    DATA_DIR=/data

# Start the application
CMD ["node", "dist/index.js"]
