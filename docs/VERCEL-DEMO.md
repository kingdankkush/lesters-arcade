# Vercel Demo Preview

This repo is set up for a safe static Vercel preview of the Lester's Arcade portal.

## What this deploys

- The static portal in `apps/portal`.
- Generated/sliced art assets already committed in the repo.
- Local simulated free/paid arcade state and mock wallet fallback.

## What this does **not** do

- Does not deploy contracts.
- Does not move funds.
- Does not require seed phrases or private keys.
- Does not require environment variables.
- Does not write official paid-run state to chain.

## Recommended Vercel setup: GitHub import

1. Push this project to a GitHub repo, preferably private while testing.
2. In Vercel, choose **Add New... → Project**.
3. Import the GitHub repo.
4. Use these project settings if Vercel asks:
   - Framework Preset: **Other**
   - Root Directory: `.`
   - Install Command: `npm install`
   - Build Command: `npm run vercel:build`
   - Output Directory: `apps/portal`
5. Deploy the preview.
6. Open the Vercel preview URL.

## Alternate setup: Vercel CLI from this folder

From the project root:

```bash
npx vercel login
npx vercel
```

Choose the same defaults:

- Link to a new project if prompted.
- Root directory: current directory / `.`
- Build command: `npm run vercel:build`
- Output directory: `apps/portal`

Use preview deploys first. Only use production deploy after the preview smoke test passes:

```bash
npx vercel --prod
```

## Demo smoke checklist

After deploy, test the preview URL:

1. Portal loads at the root URL.
2. Generated gallery art appears; scroll down and confirm all six generated images load.
3. No visible `undefined` or `null` text appears in the page.
4. Wallet rail shows LitVM LiteForge:
   - Chain ID `4441`
   - Hex `0x1159`
   - native token `zkLTC`
   - RPC/faucet/explorer/portal links
5. With no browser wallet connected, clicking **Connect Wallet** should use the local mock fallback.
6. With a browser wallet installed, the app should try injected wallet first and then ask for the LiteForge switch/add-network path when needed.
7. Free practice should remain local sandbox state only.
8. Paid-run copy should remain clearly separate from official paid-run sync/state.

If anything fails, copy the Vercel build log or browser console error and send it back for debugging.
