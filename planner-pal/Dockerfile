# Build the client
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY planner-pal/client/package.json planner-pal/client/package-lock.json ./
RUN npm ci
COPY planner-pal/client/ ./
RUN npm run build

# Runtime: a tiny Express server that just hosts the built client
FROM node:22-slim
WORKDIR /app/server
COPY planner-pal/server/package.json planner-pal/server/package-lock.json ./
RUN npm ci --omit=dev
COPY planner-pal/server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 4200
CMD ["node", "--no-warnings", "src/index.js"]
