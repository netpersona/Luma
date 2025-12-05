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

# Cache-busting argument - forces rebuild when source changes
# This is set by GitHub Actions to the commit SHA
ARG CACHEBUST=1

# Copy application source (cache invalidated by CACHEBUST arg above)
COPY . .

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

# Install runtime dependencies including su-exec for user switching
# Also include build tools to rebuild native modules for target CPU architecture
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    ttf-dejavu \
    fontconfig \
    su-exec \
    # Build tools for native module recompilation
    python3 \
    make \
    g++

# Create default app user (will be modified at runtime based on PUID/PGID)
# Use high UID/GID to avoid conflicts with existing users in base image
RUN addgroup -g 911 luma && \
    adduser -D -u 911 -G luma luma

# Copy package files
COPY package*.json ./

# Copy node_modules from builder (includes vite which is needed for server imports)
# This is larger than --omit=dev but required because server/vite.ts has static vite imports
COPY --from=builder /app/node_modules ./node_modules

# IMPORTANT: Rebuild better-sqlite3 from source for the target CPU architecture
# This fixes "Illegal instruction" errors on older CPUs that don't support AVX2
# The prebuilt binaries may use CPU instructions not available on all systems
RUN npm rebuild better-sqlite3 --build-from-source

# Copy built application from builder
# dist/ contains: index.js (bundled server) and public/ (frontend assets)
COPY --from=builder /app/dist ./dist

# Copy shared schema (needed for runtime type imports)
COPY --from=builder /app/shared ./shared

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create directories for user data
# /data stores everything: database, books, audiobooks, covers, and uploads
RUN mkdir -p /data/books /data/audiobooks /data/covers /data/uploads

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Environment defaults
# PUID/PGID: User/Group ID for file permissions (Unraid compatible)
# DATA_DIR: Location for SQLite database and all data files
ENV NODE_ENV=production \
    PORT=5000 \
    DATA_DIR=/data \
    PUID=1000 \
    PGID=1000

# Run as root initially, entrypoint will switch to correct user
ENTRYPOINT ["/docker-entrypoint.sh"]
