#!/bin/sh
set -eu

: "${MQTT_WS_URL:=ws://localhost:8000/mqtt}"

envsubst '${MQTT_WS_URL}' < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js

exec nginx -g 'daemon off;'
