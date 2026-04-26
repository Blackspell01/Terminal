FROM node:20-alpine3.22

WORKDIR /app
COPY app/package.json .
RUN npm install

CMD ["node", "server.js"]
