# ==========================================
# Build Stage
# ==========================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
# We include @flightradar24/fr24api-mcp, mcp-proxy, mcps-logger
RUN npm ci --omit=dev

# Copy server application
COPY server.js ./

# ==========================================
# Production Stage (Distroless)
# ==========================================
FROM gcr.io/distroless/nodejs20-debian12

WORKDIR /app

# Copy application and dependencies from builder
COPY --from=builder /app /app

# Use non-root user (provided by distroless)
USER nonroot

# Expose Cloud Run default port
EXPOSE 8080

# Run the server
CMD ["server.js"]
