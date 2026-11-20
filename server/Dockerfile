FROM node:20-alpine

WORKDIR /app

# Install native dependencies required by sqlite3 build
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

ENV PORT=4000

CMD ["npx", "tsx", "src/index.ts"]
