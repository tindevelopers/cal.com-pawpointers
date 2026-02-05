#!/usr/bin/env bash
# Set Resend-related env vars on Railway (Cal.com Web App) from this repo's .env.
# Requires: Railway CLI installed and logged in (railway login).
#
# 1. Link this directory to your Railway project and Cal.com Web App service (one-time):
#    cd "$(dirname "$0")/.." && railway link
# 2. Run this script from repo root:
#    ./scripts/set-railway-resend-env.sh

set -e
cd "$(dirname "$0")/.."

if ! railway status &>/dev/null; then
  echo "No linked project. Run from repo root: railway link"
  echo "Then select your project and the 'Cal.com Web App' service."
  exit 1
fi

if [ ! -f .env ]; then
  echo "No .env file. Create one with RESEND_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME."
  exit 1
fi

# Export vars from .env for this script (avoid 'export' in .env)
set -a
# shellcheck source=/dev/null
source .env
set +a

for name in RESEND_API_KEY EMAIL_FROM EMAIL_FROM_NAME; do
  if [ -z "${!name}" ]; then
    echo "Missing $name in .env"
    exit 1
  fi
done

railway variables --set "RESEND_API_KEY=$RESEND_API_KEY" \
  --set "EMAIL_FROM=$EMAIL_FROM" \
  --set "EMAIL_FROM_NAME=$EMAIL_FROM_NAME"

echo "Variables set. Redeploy the service for them to take effect (e.g. railway redeploy)."
