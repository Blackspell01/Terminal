FROM node:26-alpine3.22

WORKDIR /app
COPY app/package.json .
RUN npm install

RUN apk add --no-cache zsh git curl
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

CMD ["sh", "/app/start.sh"]