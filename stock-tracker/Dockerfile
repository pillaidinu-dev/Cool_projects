# Build the client
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY stock-tracker/client/package.json stock-tracker/client/package-lock.json ./
RUN npm ci
COPY stock-tracker/client/ ./
RUN npm run build

# Runtime: the API server, serving the built client as static files
FROM node:22-slim
WORKDIR /app/server
COPY stock-tracker/server/package.json stock-tracker/server/package-lock.json ./
RUN npm ci --omit=dev
COPY stock-tracker/server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 4200
CMD ["node", "--no-warnings", "src/index.js"]
