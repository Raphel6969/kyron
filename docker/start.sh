#!/bin/bash
set -e
echo "🛡️  Starting Kyron Layer..."

nginx &
echo "✅ nginx started"

exec uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --workers 1 \
  --log-level info
