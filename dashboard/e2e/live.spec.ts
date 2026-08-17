/**
 * The dashboard against a real backend.
 *
 * Every other spec in this directory intercepts the RPCs, which is the right
 * default — it keeps a pull request from having to stand up Nakama and Postgres
 * to answer a question about a React route. What it cannot catch is the thing
 * mocks are structurally blind to: the contract drifting. A field the dashboard
 * reads that the server stopped sending looks identical to a passing test when
 * the fixture is the one being read.
 *
 * So this file exists to be run deliberately, against a deployment:
 *
 *   E2E_LIVE_URL=https://lenterra-api.faizath.com npx playwright test live
 *
 * It is skipped entirely without that variable, and the skip says why rather
 * than passing silently — a suite that quietly reports success for tests it did
 * not run is worse than one that fails.
 *
 * **It signs nobody in.** Doing so would need a staff invite code, which is
 * single-use and confers authority over a school's records; putting one in an
 * environment variable makes it a credential in CI logs and shell history. What
 * is checked instead is everything reachable before a session exists — which is
 * exactly where a contract break between these two repositories shows up first,
 * because it is where the dashboard talks to the server without knowing
 * anything yet.
 *
 * A deeper live test is possible and is deliberately somewhere else: the
 * backend's own integration suite seeds roles through SQL, which it can do
 * because it has the database. This repository does not, and inventing an RPC
 * that would grant it one would create the privilege-escalation route the
 * backend's design removes on purpose.
 */

import { expect, test, type APIRequestContext } from '@playwright/test';

const LIVE = process.env.E2E_LIVE_URL?.replace(/\/$/, '') ?? null;

/**
 * Is there a Lenterra behind that URL at all?
 *
 * Three of the tests below assert that something is *refused*, and a parked
 * domain, a proxy, or somebody else's server answers 403 to everything — which
 * is indistinguishable from refusing correctly. Pointed at
 * `lenterra-api.faizath.com` before anything was deployed there, this file
 * reported three passes and two failures, and the three passes were worthless.
 *
 * So reachability is established first, and every other test skips loudly when
 * it fails. A row of ticks against a host with nothing on it is worse than no
 * check at all, because it reads as partial success.
 */
let reachable: boolean | null = null;

async function assertReachable(request: APIRequestContext): Promise<void> {
  if (reachable === null) {
    try {
      const response = await request.get(`${LIVE}/healthcheck`, {
        failOnStatusCode: false,
        timeout: 20_000,
      });
      reachable = response.ok();
    } catch {
      reachable = false;
    }
  }
  test.skip(
    !reachable,
    `nothing healthy is deployed at ${LIVE} — the refusal checks below would pass ` +
      'against a parked domain, so they are not run',
  );
}

test.describe('against a live backend', () => {
  test.skip(
    () => LIVE === null,
    'set E2E_LIVE_URL to a deployment to run these — they are skipped, not passing',
  );

  test.beforeEach(async ({ request }) => {
    await assertReachable(request);
  });

  test('the verifier is reachable and configured for code sign-in', async ({ request }) => {
    // The single most consequential misconfiguration, and the one that is
    // invisible from the dashboard: with either secret missing, the sign-in
    // screen looks perfectly healthy and no code will ever work.
    const response = await request.get(`${LIVE}/verifier/health`, { timeout: 20_000 });
    expect(response.ok(), `verifier health answered ${response.status()}`).toBe(true);

    const body = (await response.json()) as { codeSignIn?: boolean };
    expect(
      body.codeSignIn,
      'codeSignIn is false — a secret is missing and nobody can sign in with a code',
    ).toBe(true);
  });

  test('the staff-code endpoint refuses an invalid code without leaking why', async ({
    request,
  }) => {
    const response = await request.post(`${LIVE}/verifier/session/staff-code`, {
      data: { code: 'ZZZZZZZZZZ', deviceId: 'e2e-live-probe' },
      failOnStatusCode: false,
      timeout: 20_000,
    });

    expect(response.ok(), 'an invented code must never mint a session').toBe(false);

    // Spent, revoked, expired and never-existed are deliberately one answer on
    // the server. If this ever starts distinguishing them, somebody with a list
    // of guesses can learn which codes were issued — and an issued staff code
    // names a school.
    const text = (await response.text()).toLowerCase();
    for (const leak of ['expired', 'revoked', 'redeemed', 'already used']) {
      expect(text, `the refusal named "${leak}", which tells an attacker which case they hit`)
        .not.toContain(leak);
    }
  });

  test('an authenticated rpc refuses an anonymous caller', async ({ request }) => {
    const response = await request.post(`${LIVE}/v2/rpc/v1.session.bootstrap`, {
      // Nakama's HTTP RPC envelope: the body is a JSON-encoded *string*
      // containing the JSON payload, so it is stringified twice.
      data: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      failOnStatusCode: false,
      timeout: 20_000,
    });

    expect([401, 403]).toContain(response.status());
  });

  test('the nakama console is not exposed', async ({ request }) => {
    // A full administrative interface over children's records. Compose does not
    // publish it and Caddy refuses it, so this is the check that both are still
    // true after somebody edits one of them.
    const response = await request.get(`${LIVE}/console`, {
      failOnStatusCode: false,
      timeout: 20_000,
    });
    expect(response.status()).toBe(404);
  });

  test('the runtime modules are loaded', async ({ request }) => {
    // A stack that starts with a stale or missing bundle looks entirely healthy
    // from outside: Nakama answers, TLS is valid, and every RPC 404s. Asking
    // for a route that only exists if the modules registered tells them apart.
    const response = await request.post(`${LIVE}/v2/rpc/v1.catalog.manifest`, {
      data: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      failOnStatusCode: false,
      timeout: 20_000,
    });

    expect(
      response.status(),
      'v1.catalog.manifest is not registered — are the modules built and mounted?',
    ).not.toBe(404);
  });
});
