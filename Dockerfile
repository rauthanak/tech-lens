# ── tech-lens · portal image ──────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Dependencies first, so code edits don't re-run npm ci.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# The /api rewrite destination is baked into the build (routes manifest),
# so the API address must be set here, not at container runtime.
ARG TECH_ATLAS_API_URL=http://atlas:8100
ENV TECH_ATLAS_API_URL=$TECH_ATLAS_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3100
CMD ["npm", "run", "start"]
