# ---- Stage 1: Build ----
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDeps for tsc)
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ---- Stage 2: Runtime ----
FROM node:22-alpine

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -S camofox && adduser -S camofox -G camofox

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Switch to non-root
USER camofox

# Environment defaults
ENV NODE_ENV=production
ENV CAMOFOX_URL=http://localhost:9377

# Use tini as entrypoint for signal forwarding
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
