FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM dependencies AS build
COPY tsconfig.json tsconfig.frontend.json vite.config.ts ./
COPY src ./src
COPY frontend ./frontend
COPY dist ./dist
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-eng python3 libarchive13 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY scripts/read-knowledge-archive.py ./scripts/
USER node
EXPOSE 4173
CMD ["node", "build/server.js"]
