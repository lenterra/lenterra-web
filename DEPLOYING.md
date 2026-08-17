# Deploying

Both artefacts are static and go to **Cloudflare Pages** as one deployment, at
`lenterra.faizath.com`.

```bash
npm ci
npm run deploy:web
```

That builds the landing site, runs its checks, builds the dashboard with its
bundle budget, assembles both into `dist-web/`, and uploads it.

## One artefact, deliberately

The site sits at the root and the dashboard under `/dashboard`, which is what
every path in both already assumes — the site's navigation is root-absolute and
Vite's `base` is `/dashboard/`.

This is also a fix. The GitHub Actions workflows that used to do this each
uploaded a *complete* deployment containing only their own half, into the same
target: whichever ran last erased the other. Building one directory makes that
impossible rather than unlikely.

## First time

Create the Pages project once, then point the domain at it:

```bash
npx wrangler@3 pages project create lenterra --production-branch main
npx wrangler@3 pages deployment list --project-name lenterra
```

Add `lenterra.faizath.com` as a custom domain in the Cloudflare dashboard. Both
halves depend on being served from the **root** of a domain; under a project
path every link would resolve one level too high and the dashboard would load
no assets at all.

## Configuration

The dashboard defaults to `lenterra-api.faizath.com` over TLS and needs no
environment at all to build. Set `VITE_*` values only to point somewhere else —
see `dashboard/.env.example`. None of them are secrets; every client holds
them.

## Checks

There is no CI in this repository, so these run when somebody runs them:

```bash
npm run typecheck
npm run test:dashboard      # component tests
npm run test:e2e            # teacher flow, admin, moderation, and axe
npm run check:site          # page weight, forbidden language, no app downloads
```

`deploy:web` runs the site checks and the bundle budget because both are part of
building. It does **not** run the test suites — so run them first. The
accessibility pass and the language check are the two that rot quietest, since
neither failure is visible to somebody who has not gone looking.

## What the site checks refuse

- **Page weight** over 500 KB, excluding video.
- **Forbidden language**: crypto, blockchain, wallet, token, thirdweb, and the
  rest. A principal who searches Lenterra and finds crypto language will not run
  a pilot, and would be right not to on the information available.
- **Student-facing downloads**: `.apk` links, store links. The pilot's consent
  model runs through schools, and a download button aimed at a fourteen-year-old
  routes around the only mechanism that makes collecting their data lawful.

## Rolling back

Cloudflare keeps every deployment. Roll back from the dashboard, or:

```bash
npx wrangler@3 pages deployment list --project-name lenterra
```

A rollback is instant and does not need this repository, which is the useful
property when the reason for rolling back is that the build is broken.
