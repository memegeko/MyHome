#!/usr/bin/env bash
set -euo pipefail

repository="${MYHOME_REPOSITORY:-https://github.com/memegeko/MyHome.git}"
destination="${1:-MyHome}"

git clone "$repository" "$destination"
cd "$destination"
./scripts/bootstrap.sh static

echo
echo "Run: cd $destination && npm run dev"
