# lenterra-web

Two static artefacts, one repository, one deploy:

| Path | What |
|---|---|
| `dashboard/` | The teacher dashboard, served at `/dashboard` |
| `site/` | The public landing site, served at `/` |

Neither has a backend. Both call the same Nakama RPCs the student app calls,
under the same authorisation model. That is deliberate: a dashboard-specific API
would mean a second implementation of "may this teacher read this class", and
duplicated authorisation is how a teacher ends up able to read another school's
children's data.

## Deploying

Both artefacts go to Cloudflare Pages as one deployment, at
`lenterra.faizath.com`:

```bash
npm run deploy:web
```

See [DEPLOYING.md](DEPLOYING.md). The single artefact is deliberate — it is what
stops the two halves from erasing each other, which is what the deleted
workflows did.

## Paths, and what the repository name decides

Every internal link here is root-absolute: the site's navigation is built from
`/`, `/en/`, `/sekolah/`, and the dashboard's Vite `base` is `/dashboard/`.
That holds while the site is served from the root of a domain — a custom domain,
or the organisation's own `<org>.github.io` repository.

Under a **project** Pages path (`https://<org>.github.io/lenterra-web/`) it does
not: every link would resolve one level too high and the dashboard would load no
assets at all. Serving from a project path means setting Vite's `base` and the
site generator's link prefix together, and updating the asset pattern in
`dashboard/scripts/budget.mjs` to match — it looks for `/dashboard/assets/`.

## Running the dashboard

```bash
npm ci
cp dashboard/.env.example dashboard/.env.local   # then fill in the values
npm run dev
```

`dashboard/.env.local` is required. Nothing in it is a secret — every client
holds these values — but they are injected rather than committed so that
pointing at staging is a build variable rather than a source edit.

## Checks

```bash
npm run typecheck
npm run test:dashboard
npm run build:dashboard     # includes the bundle-budget check
npm run check:site          # page weight, forbidden language, no app downloads
npm run test:e2e            # teacher flow + axe, needs a Chromium download
```

Nothing runs these automatically. There is no CI in this repository, so the
last three in particular are only as good as the habit of running them — the
accessibility pass and the language check are the ones that will rot quietest,
because neither failure is visible to somebody who does not go looking.

The build fails if the initial load exceeds **200 KB gzipped**. That number
comes from the reference environment in the technical spec: an older Windows
laptop on a 3G-class connection. It is enforced rather than reviewed, because a
budget nobody enforces drifts one dependency at a time until a teacher waits
nine seconds for a class list and nobody can point at the commit responsible.

The wallet SDK is behind a dynamic import for the same reason. A teacher opening
their class list has not signed in today and should not download the sign-in
code to find that out.
