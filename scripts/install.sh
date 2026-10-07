#!/usr/bin/env bash
set -euo pipefail

# Download into a new directory; existing installations are never overwritten.
myhome_ref="${MYHOME_REF:-work}"
myhome_dir="${MYHOME_DIR:-$PWD/MyHome}"
myhome_node_version="v24.14.0"
command -v curl >/dev/null || { echo 'Install curl, then run this command again.' >&2; exit 1; }
command -v gzip >/dev/null || { echo 'Install gzip, then run this command again.' >&2; exit 1; }
command -v tar >/dev/null || { echo 'Install tar, then run this command again.' >&2; exit 1; }
[ ! -e "$myhome_dir" ] || { echo "Already exists: $myhome_dir. Run npm run setup:cloudflare there, or choose MYHOME_DIR." >&2; exit 1; }
myhome_tmp="$(mktemp -d)"
trap 'rm -rf "$myhome_tmp"' EXIT

if ! command -v node >/dev/null || ! command -v npm >/dev/null || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'; then
  case "$(uname -s)" in Linux) myhome_os=linux ;; Darwin) myhome_os=darwin ;; *) echo 'Use the PowerShell installer on Windows.' >&2; exit 1 ;; esac
  case "$(uname -m)" in x86_64|amd64) myhome_arch=x64 ;; aarch64|arm64) myhome_arch=arm64 ;; *) echo 'Unsupported CPU. Install Node.js 22.18+ yourself.' >&2; exit 1 ;; esac
  myhome_archive="node-$myhome_node_version-$myhome_os-$myhome_arch.tar.gz"
  echo 'Downloading a local Node.js runtime (no administrator access needed)...'
  curl --fail --location --retry 2 "https://nodejs.org/dist/$myhome_node_version/$myhome_archive" -o "$myhome_tmp/$myhome_archive"
  curl --fail --location --retry 2 "https://nodejs.org/dist/$myhome_node_version/SHASUMS256.txt" -o "$myhome_tmp/SHASUMS256.txt"
  myhome_expected="$(awk -v name="$myhome_archive" '$2 == name {print $1}' "$myhome_tmp/SHASUMS256.txt")"
  if command -v sha256sum >/dev/null; then myhome_actual="$(sha256sum "$myhome_tmp/$myhome_archive" | awk '{print $1}')"; else myhome_actual="$(shasum -a 256 "$myhome_tmp/$myhome_archive" | awk '{print $1}')"; fi
  [ -n "$myhome_expected" ] && [ "$myhome_actual" = "$myhome_expected" ] || { echo 'Node.js checksum verification failed.' >&2; exit 1; }
  tar -xzf "$myhome_tmp/$myhome_archive" -C "$myhome_tmp"
  myhome_runtime="$myhome_tmp/node-$myhome_node_version-$myhome_os-$myhome_arch"
fi

echo 'Downloading MyHome...'
curl --fail --location --retry 2 "https://codeload.github.com/memegeko/MyHome/tar.gz/$myhome_ref" -o "$myhome_tmp/myhome.tar.gz"
mkdir "$myhome_tmp/source"
tar -xzf "$myhome_tmp/myhome.tar.gz" -C "$myhome_tmp/source" --strip-components=1
[ -f "$myhome_tmp/source/package-lock.json" ] || { echo 'Download is missing the MyHome lockfile.' >&2; exit 1; }
mkdir -p "$(dirname "$myhome_dir")"
mv "$myhome_tmp/source" "$myhome_dir"
cd "$myhome_dir"
if [ -n "${myhome_runtime:-}" ]; then
  mkdir -p .cache
  mv "$myhome_runtime" .cache/node
  export PATH="$PWD/.cache/node/bin:$PATH"
fi
cat > start-setup.sh <<'START'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ -d .cache/node/bin ]; then export PATH="$PWD/.cache/node/bin:$PATH"; fi
if [ ! -d node_modules ]; then npm ci --cache .cache/npm; fi
npm run setup:cloudflare
START
chmod +x start-setup.sh
printf '\nInstalling dependencies in %s...\n' "$PWD"
npm ci --cache .cache/npm
printf '\nOpening MyHome Setup. Keep this terminal open.\nLater, run: ./start-setup.sh\n'
./start-setup.sh
