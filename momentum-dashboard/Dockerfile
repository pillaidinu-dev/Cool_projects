FROM node:22-slim
WORKDIR /app/server
COPY momentum-dashboard/server/package.json momentum-dashboard/server/package-lock.json ./
RUN npm ci --omit=dev
COPY momentum-dashboard/server/ ./
COPY momentum-dashboard/client/ /app/client/
COPY momentum-dashboard/data/ /app/data/

ENV NODE_ENV=production
EXPOSE 4100
CMD ["node", "--no-warnings", "src/server.js"]
