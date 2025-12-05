#!/bin/sh
set -e

# Default PUID and PGID to 1000 if not set
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting Luma with UID: $PUID, GID: $PGID"

# Update luma group GID if different
if [ "$(id -g luma)" != "$PGID" ]; then
    echo "Updating luma group GID to $PGID"
    delgroup luma 2>/dev/null || true
    addgroup -g "$PGID" luma
fi

# Update luma user UID if different
if [ "$(id -u luma)" != "$PUID" ]; then
    echo "Updating luma user UID to $PUID"
    deluser luma 2>/dev/null || true
    adduser -D -u "$PUID" -G luma luma
fi

# Ensure /data directory exists and has correct permissions
mkdir -p /data/books /data/audiobooks /data/covers /data/uploads
chown -R luma:luma /data
chown -R luma:luma /app

echo "Data directory: /data"
echo "Starting application..."

# Run the application as the luma user
exec su-exec luma node dist/index.js
