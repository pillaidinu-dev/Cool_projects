# Build the client
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY nfl-dashboard/client/package.json nfl-dashboard/client/package-lock.json ./
RUN npm ci
COPY nfl-dashboard/client/ ./
RUN npm run build

# Runtime: the API server, serving the built client as static files
FROM node:22-slim
WORKDIR /app/server
COPY nfl-dashboard/server/package.json nfl-dashboard/server/package-lock.json ./
RUN npm ci --omit=dev
COPY nfl-dashboard/server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 4100
CMD ["node", "--no-warnings", "src/index.js"]
