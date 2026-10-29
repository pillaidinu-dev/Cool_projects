# Build the client
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY gold-tracker/client/package.json gold-tracker/client/package-lock.json ./
RUN npm ci
COPY gold-tracker/client/ ./
RUN npm run build

# Runtime: a tiny Express server that just hosts the built client
FROM node:22-slim
WORKDIR /app/server
COPY gold-tracker/server/package.json gold-tracker/server/package-lock.json ./
RUN npm ci --omit=dev
COPY gold-tracker/server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 4400
CMD ["node", "--no-warnings", "src/index.js"]
