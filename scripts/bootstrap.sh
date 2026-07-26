#!/usr/bin/env bash
set -euo pipefail

edition="${1:-static}"

if [[ "$edition" != "static" && "$edition" != "server" ]]; then
  echo "Usage: ./scripts/bootstrap.sh [static|server]"
  exit 1
fi

install_prerequisites() {
  if command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --needed --noconfirm git nodejs npm
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y git curl ca-certificates
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y git nodejs npm
  elif command -v zypper >/dev/null 2>&1; then
    sudo zypper --non-interactive install git nodejs22 npm22
  elif command -v apk >/dev/null 2>&1; then
    sudo apk add git nodejs npm
  elif command -v brew >/dev/null 2>&1; then
    brew install git node@22
    brew link --overwrite node@22
  else
    echo "Install Git and Node.js 22 or newer, then run this script again."
    exit 1
  fi
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Installing Git, Node.js and npm for this system..."
  install_prerequisites
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < 22 )); then
  echo "MyHome needs Node.js 22 or newer. Found $(node --version)."
  echo "Update Node.js and run this command again."
  exit 1
fi

echo "Installing MyHome dependencies..."
npm ci --cache .cache/npm

if [[ "$edition" == "server" ]]; then
  if [[ ! -f .dev.vars ]]; then
    if command -v openssl >/dev/null 2>&1; then
      secret="$(openssl rand -hex 32)"
    else
      secret="$(node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))')"
    fi
    printf 'SESSION_SECRET=%s\n' "$secret" > .dev.vars
    chmod 600 .dev.vars
  fi
  npx wrangler d1 migrations apply myhome --local
  echo
  echo "MyHome server edition is ready."
  echo "Start it with: npm run dev:server"
else
  echo
  echo "MyHome static edition is ready."
  echo "Start it with: npm run dev"
fi
