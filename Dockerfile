FROM node:20-alpine3.22

WORKDIR /app
COPY app/package.json .
RUN npm install

RUN apk add --no-cache zsh git curl
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

CMD ["sh", "-c", "cp -f /root/.zshrc /app/omz/.zshrc && cp -a /root/.oh-my-zsh /app/omz/.oh-my-zsh && sed -i '/^export ZSH=/d' /app/omz/.zshrc && exec node server.js"]
