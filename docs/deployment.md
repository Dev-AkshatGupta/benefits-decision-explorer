# Static demonstration deployment

## Current status

Vercel configuration and a production demo build are provided without a backend. Local production-preview checks cover worker/API behavior and deep-link refreshes. **No live deployment or public URL has been verified.** Local preview does not verify hosted delivery.

## Build and inspect

Use Node.js 24 LTS, npm and the committed lockfile.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build:demo
npm run preview
```

Output is `dist/`. Confirm `/mockServiceWorker.js` returns JavaScript, not HTML, and `/patients/patient-011` loads directly and after refresh. `npm run test:demo` automates these checks plus typed fixture mutations/reset, tab isolation, screening/simulation/policy calculations and accessible confirmation.

`npm run build` intentionally produces a non-demo shell unless the flag is true. Do not upload that artifact for a backend-free demonstration. `.env.demo` sets `VITE_DEMO_MODE=true`; shell/project variables take precedence, so false overrides are rejected by the demo build. Vite embeds public configuration at build time; provider changes require rebuilding. There are no secrets to configure.

## Vercel

`vercel.json` sets framework `vite`, build `npm run build:demo`, output `dist` and a SPA rewrite. Existing static files must resolve normally. The worker is served at root scope with no-store/no-cache headers. Other headers prevent MIME sniffing, reduce referrer disclosure and deny framing. No CSP compatibility or regulatory certification is claimed.

1. Put this directory in your own Git repository and import it into Vercel, or use Vercel CLI after signing into your own account. No account/token is supplied here.
2. Select Node 24. Retain the committed build command and output directory.
3. If setting `VITE_DEMO_MODE` in the provider, use `true`; never place private information in `VITE_*` variables.
4. Deploy a preview before assigning a production domain. Use an HTTPS origin root, not a subfolder. Disable provider dev toolbars/debug overlays for the founder-facing URL.
5. Perform the hosted checks below before recording the real URL and verification date.

See Vercel's [Vite SPA guidance](https://vercel.com/docs/frameworks/frontend/vite) and [configuration reference](https://vercel.com/docs/project-configuration/vercel-json), plus MSW's [browser integration](https://mswjs.io/guides/integrations/browser) and [startup reference](https://mswjs.io/api/setup-worker/start). Cloud routing still needs live verification.

## Hosted verification

Replace the placeholder with your real deployment origin:

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:DEMO_BASE_URL='https://your-actual-demo-host.example'
npm run test:demo:remote
Remove-Item Env:DEMO_BASE_URL
```

The remote command rejects missing URLs, credentials/tokens and subpaths. Tests modify only fictional tab-local data and require a demo banner/active worker before mutations.

- Patient, eligibility/simulator, policy, task and coverage deep links load and refresh.
- Worker/hashed assets return correct MIME types; worker content is not `index.html`.
- Worker scope is root; `/api/health` and data requests are intercepted.
- Screening, hypothetical inputs and population analysis produce seeded results.
- Canceled reset preserves edits; confirmation restores stores and clears drafts/traces after completion.
- Other tabs retain independent state; desktop/mobile confirmation and focus work.

Inspect actual worker/security headers in the hosting dashboard or Network panel. Local Vite preview does not prove Vercel header delivery, CDN behavior, access protection or public availability. HTTPS/worker support is required; blocked workers produce startup failure instead of hardcoded component data.

## Reset, update and rollback

Reset restores this tab's fixtures and clears caches/local snapshots via reload. There is no server-wide reset or saved history. A failed response does not claim completion; retry is safe because reset is idempotent. Use the confirmed action rather than manually clearing storage.

Rebuild and test previews before promoting changes. Roll back a broken deployment through your provider to a previously verified artifact and rerun hosted checks. Regenerate `public/mockServiceWorker.js` only after upgrading MSW, then test a fresh tab. Keep private env files and `.vercel/` metadata out of source control.
