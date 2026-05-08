#!/bin/sh
set -eu

CERTS_DIR="$(dirname "$0")/../nginx/certs"
mkdir -p "$CERTS_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  -subj "/C=FR/ST=IDF/L=Paris/O=42/OU=transcendence/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Self-signed certificate generated in $CERTS_DIR"
