FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

# remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# copia SOMENTE o frontend gerado
COPY --from=builder /app/dist/client /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
