#!/bin/sh
set -eu

mkdir -p "$DATA_DIR"
chown -R "${PUID}:${PGID}" "$DATA_DIR"

exec su-exec "${PUID}:${PGID}" "$@"
