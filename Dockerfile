FROM node:20-slim

WORKDIR /app
COPY app/package.json .
RUN npm install

CMD ["node", "server.js"]
