FROM node:22.13.0-slim

# Create app directory and set ownership
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Add non root user
RUN groupadd -r nodejs && \
    useradd -r -g nodejs -s /bin/bash nodejs && \
    chown -R nodejs:nodejs /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=10000

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:$PORT/ || exit 1

# Expose port from environment variable
EXPOSE $PORT

CMD ["npm", "start"]
