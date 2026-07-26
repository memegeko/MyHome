# Install MyHome

> [View the complete static showcase](https://memegeko.github.io/MyHome/?demo=showcase) · [Download the importable example ZIP](https://memegeko.github.io/MyHome/examples/myhome-showcase.zip)

MyHome has two editions:

- **Static** — easiest; works on GitHub Pages and ordinary web hosting.
- **Server** — adds a shared owner account, D1 storage and R2 uploads through
  Cloudflare Workers.

## GitHub Pages

1. Fork or use this repository as a template.
2. Open **Settings → Pages**.
3. Choose **GitHub Actions** as the source.
4. Wait for **Deploy static edition** to finish.
5. Open the Pages address and complete the setup wizard.

No local installation is required.

## Arch Linux and derivatives

```bash
sudo pacman -S --needed git nodejs npm
git clone https://github.com/memegeko/MyHome.git && cd MyHome
./scripts/bootstrap.sh static
npm run dev
```

Use `server` instead of `static` and run `npm run dev:server` for local server
mode.

## Debian, Ubuntu and derivatives

```bash
git clone https://github.com/memegeko/MyHome.git && cd MyHome
./scripts/bootstrap.sh static
npm run dev
```

The bootstrapper installs Node.js 22 when it is not already available.

## Fedora

```bash
sudo dnf install -y git nodejs npm
git clone https://github.com/memegeko/MyHome.git && cd MyHome
./scripts/bootstrap.sh static
npm run dev
```

## openSUSE

```bash
sudo zypper install git nodejs22 npm22
git clone https://github.com/memegeko/MyHome.git && cd MyHome
./scripts/bootstrap.sh static
npm run dev
```

## Alpine Linux

```bash
sudo apk add git nodejs npm
git clone https://github.com/memegeko/MyHome.git && cd MyHome
./scripts/bootstrap.sh static
npm run dev
```

## macOS

```bash
brew install git node@22
git clone https://github.com/memegeko/MyHome.git && cd MyHome
./scripts/bootstrap.sh static
npm run dev
```

## Windows 10 or 11

Open PowerShell:

```powershell
winget install --id Git.Git --exact
git clone https://github.com/memegeko/MyHome.git
cd MyHome
.\scripts\bootstrap.ps1 static
npm run dev
```

## One-command clone and preparation

Linux and macOS can clone and prepare an edition with:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/memegeko/MyHome/main/scripts/install-static.sh)
```

For the local server edition:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/memegeko/MyHome/main/scripts/install-server.sh)
```

Review remote scripts before running them. The scripts clone MyHome, install
dependencies and prepare the selected edition.

## Production server deployment

Local server mode is prepared automatically. Production still needs a
Cloudflare account because D1 and R2 resources must belong to someone:

```bash
npx wrangler login
npx wrangler d1 create myhome
npx wrangler r2 bucket create myhome-media
```

Copy the returned D1 ID into `wrangler.jsonc`, then finish with:

```bash
npx wrangler d1 migrations apply myhome --remote
npx wrangler secret put SESSION_SECRET
npm run deploy:server
```

See the [server deployment guide](../deployment/SERVER.md) for explanations.
