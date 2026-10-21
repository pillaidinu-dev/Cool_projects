# Build the client
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY nba-dashboard/client/package.json nba-dashboard/client/package-lock.json ./
RUN npm ci
COPY nba-dashboard/client/ ./
RUN npm run build

# Runtime: the API server, serving the built client as static files, plus a
# Python environment so the server can run the daily prop pipeline itself.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/ml
COPY nba-dashboard/ml/requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt
COPY nba-dashboard/ml/ ./
COPY nba-dashboard/data/ /app/data/
COPY nba-dashboard/data-sample/ /app/data-sample/

WORKDIR /app/server
COPY nba-dashboard/server/package.json nba-dashboard/server/package-lock.json ./
RUN npm ci --omit=dev
COPY nba-dashboard/server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV NBA_SERVER_REFRESH=1
EXPOSE 4200
CMD ["node", "--no-warnings", "src/index.js"]
