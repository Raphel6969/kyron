# ── Stage 1: Build React Frontend ────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --silent

COPY frontend/ ./
# Build for production (VITE_API_URL will be set so it proxies via nginx)
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ── Stage 2: Python Backend (with ML model baked in) ─────────────────────────
FROM python:3.11-slim AS backend

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 🔑 Pre-bake the ML embedding model into the image at build time
# This eliminates the 25s cold-start download on first request
RUN python -c "from sentence_transformers import SentenceTransformer; m = SentenceTransformer('all-MiniLM-L6-v2'); print('✅ Model cached:', m)"

# Copy backend application
COPY backend/app ./app
COPY policy/ ./policy/
COPY .env.example ./.env.example

# Copy built React frontend into nginx html dir
COPY --from=frontend-builder /frontend/dist /usr/share/nginx/html
COPY --from=frontend-builder /frontend/dist/kyron_logo.png /usr/share/nginx/html/ 2>/dev/null || true

# ── Nginx config: serve React + proxy /screen /auth /events /demo /tokens /users /health /docs /ws ──
RUN cat > /etc/nginx/conf.d/kyron.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # API proxy — all backend routes
    location ~ ^/(screen|auth|events|demo|tokens|users|health|docs|openapi.json|ws) {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }

    # React SPA — everything else serves index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check for Render
    location /nginx-health {
        return 200 'ok';
        add_header Content-Type text/plain;
    }
}
EOF

# Remove default nginx site
RUN rm -f /etc/nginx/sites-enabled/default

# ── Startup script ─────────────────────────────────────────────────────────
RUN cat > /app/start.sh << 'EOF'
#!/bin/bash
set -e
echo "🛡️  Starting Kyron Layer..."

# Start nginx in background
nginx &
echo "✅ nginx started"

# Start FastAPI backend
uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --workers 1 \
  --log-level info \
  --no-access-log
EOF
RUN chmod +x /app/start.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["/app/start.sh"]
