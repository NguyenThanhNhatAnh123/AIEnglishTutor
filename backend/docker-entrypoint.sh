#!/bin/sh
set -eu

mkdir -p /app/uploads
chown -R spring:spring /app/uploads

exec su -s /bin/sh spring -c 'exec /opt/java/openjdk/bin/java -XX:+UseG1GC -XX:MaxRAMPercentage=75.0 -jar /app/app.jar'
