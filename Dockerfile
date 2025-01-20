FROM node:18.18.0-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 10000
CMD ["npm", "start"]
