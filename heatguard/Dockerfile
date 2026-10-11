FROM node:22-slim
WORKDIR /app
COPY heatguard/package.json heatguard/package-lock.json ./
RUN npm ci --omit=dev
COPY heatguard/ ./
ENV NODE_ENV=production PORT=4200
EXPOSE 4200
CMD ["node", "src/server.js"]
