# ☁️ Install your own home

[Wiki home](README.md) · [Next: customization](Customization.md)

Paste this into **Windows PowerShell**:

```powershell
& ([scriptblock]::Create((Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/memegeko/MyHome/work/scripts/install.ps1').Content))
```

Or into a **Linux / macOS terminal**:

```bash
curl -fsSL https://raw.githubusercontent.com/memegeko/MyHome/work/scripts/install.sh | bash
```

The script downloads the project into a new `MyHome` folder, installs a local
Node.js runtime if necessary, installs dependencies, and opens the setup wizard.
No Git or administrator privileges are required. Inspect the scripts in the
[repository](../../scripts/) before running downloaded code. These URLs use
`work` until the changes are merged. Linux/macOS require curl, tar, gzip and a SHA-256
utility. Existing folders are preserved.

Keep the terminal open. Open the private setup link it prints if your browser
does not open automatically.

![Connect your Cloudflare account](../screenshots/installer-account.png)

1. Connect your own Cloudflare account and enter its account ID.
2. Choose your display name, username, bio and site address prefix.
3. Pick your colors and font, then open **More personalization** for extra controls.
4. Choose password, GitHub, or both. GitHub requires your own OAuth app.
5. Review the choices and select **Install MyHome**.

The address is `site.account-subdomain.workers.dev`. You retain control of the
Worker and D1 database in your Cloudflare dashboard. R2 uploads are optional;
Cloudflare may require billing activation for R2. Free-tier usage limits apply.

![Installation progress](../screenshots/installer-progress.png)

Save the recovery code privately when installation finishes. The completion
screen gives you links to the site and admin panel.

![Example completion screen with test recovery data](../screenshots/installer-success.png)

These installer screenshots use simulated deployment responses. For OAuth app
configuration, retry behavior and custom domains, read the
[complete deployment guide](../deployment/WIZARD.md).

Prefer GitHub Pages? Follow the [static deployment guide](../deployment/STATIC.md).

## Reopen or retry

On Windows, double-click `MyHome/start-setup.cmd`. On Linux/macOS, run
`./MyHome/start-setup.sh`. The launcher finds the bundled Node runtime if one
was downloaded. If dependency installation failed before `node_modules` was created, the
launcher retries installation. For a partial installation, run `npm ci` in
MyHome using the system or bundled runtime, then use the launcher.

For a different destination, set `MYHOME_DIR` on Linux/macOS, or pass
`-InstallDirectory` to the downloaded PowerShell script block.
