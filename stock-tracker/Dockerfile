# Build the client
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY stock-tracker/client/package.json stock-tracker/client/package-lock.json ./
RUN npm ci
COPY stock-tracker/client/ ./
RUN npm run build

# Runtime: the API server, serving the built client as static files. SQLite
# comes from Node's built-in node:sqlite, so there's no native module to build.
FROM node:22-slim
WORKDIR /app/server
COPY stock-tracker/server/package.json stock-tracker/server/package-lock.json ./
RUN npm ci --omit=dev
COPY stock-tracker/server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
# Point this at a mounted volume to keep positions across redeploys.
ENV DB_PATH=/data/stocks.db
EXPOSE 4200
CMD ["node", "--no-warnings", "src/index.js"]
