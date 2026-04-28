FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache gettext

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html
COPY public/env.js /usr/share/nginx/html/env.template.js

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
