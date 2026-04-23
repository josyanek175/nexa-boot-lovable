FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port 3000"]
