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

# ── Nginx config: serve React + proxy backend routes ──────────────────────────
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

# ── Startup script ────────────────────────────────────────────────────────────
COPY docker/start.sh /app/start.sh
RUN sed -i 's/\r$//' /app/start.sh && chmod +x /app/start.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["/app/start.sh"]
