# Administrácia kostolov pre Synology NAS (alebo iný server s Dockerom)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx vite build

FROM node:22-alpine
WORKDIR /app
# Iba knižnice servera v presných verziách z package-lock.json (ako v inštalátore pre Orange Pi)
COPY package-lock.json ./
RUN node -e ' \
  const fs = require("fs"); \
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8")); \
  const names = ["cors", "dotenv", "express", "pdfjs-dist", "ws"]; \
  const dependencies = Object.fromEntries(names.map((n) => [n, lock.packages["node_modules/" + n].version])); \
  fs.writeFileSync("package.json", JSON.stringify({ name: "songdisplay", private: true, type: "module", dependencies }, null, 2)); \
  ' && npm install --omit=optional --omit=dev --no-audit --no-fund --no-package-lock && rm package-lock.json
COPY --from=build /app/dist ./dist
COPY server ./server
# Spevník JKS – z neho sa plnia nové kostoly
COPY songs.json ./songs.json
ENV NODE_ENV=production \
    APP_PORT=8080 \
    STATE_PORT=3002 \
    ADMIN_DATA_DIR=/data
VOLUME /data
EXPOSE 8080
CMD ["node", "server/index.js", "--serve"]
