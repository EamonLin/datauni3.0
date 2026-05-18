#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATE_STR="$(date +%F)"
OUT_FILE="${1:-tenant-wheel_v1_${DATE_STR}.zip}"

cd "$ROOT_DIR"
zip -r "$OUT_FILE" backend frontend docs scripts -x "*/node_modules/*" "*/dist/*" "*/data/*" "*/.DS_Store"

echo "Exported: $ROOT_DIR/$OUT_FILE"

