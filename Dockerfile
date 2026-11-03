# Administrácia TV Display pre Synology NAS (alebo iný Docker server)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    STATE_FILE=/tmp/tvdisplay-state.json
COPY --from=build /app/dist ./dist
COPY server ./server
# Spevník JKS - z neho sa plnia nové kostoly
COPY songs.json ./songs.json
VOLUME /data
EXPOSE 8080
CMD ["node", "server/server.mjs"]
