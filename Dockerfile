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
COPY scripts/ ./scripts/

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
COPY --from=builder --chown=camofox:camofox /app/dist ./dist
COPY --from=builder --chown=camofox:camofox /app/node_modules ./node_modules
COPY --from=builder --chown=camofox:camofox /app/package.json ./

# Ensure the non-root user can write under /app if future features need it
RUN chown -R camofox:camofox /app

# Switch to non-root
USER camofox

# Environment defaults
ENV NODE_ENV=production
ENV CAMOFOX_URL=http://localhost:9377

# Use tini as entrypoint for signal forwarding
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
