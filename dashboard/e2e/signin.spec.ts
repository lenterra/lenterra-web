/**
 * Signing in with a staff invite code.
 *
 * Kept out of `teacher.spec.ts` because everything there begins already signed
 * in, and these tests must begin signed *out* — the one condition that file's
 * `beforeEach` removes.
 *
 * The verifier is intercepted rather than run. What is being checked is not
 * whether the verifier works but whether this screen behaves differently for
 * the three failures a teacher can actually act on: a code that is wrong, a
 * code that has been spent, and a service that cannot be reached. Collapsing
 * those into one message leaves somebody retyping a code that will never work.
 */

import { expect, test } from '@playwright/test';

import { mockRpc } from './fixtures';

const CUSTOM_ID = 'lc_2f6c1d8b9a4e5f7c0b3d6e1a8c9f2b4d';

/** A syntactically valid session, as Nakama's authenticate call would return. */
function sessionBody() {
  const claims = {
    uid: 'teacher-1',
    usn: 'teacher',
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  };
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify(claims)).toString('base64url'),
    'e2e-not-a-real-signature',
  ].join('.');
  return { token, refresh_token: token, created: true };
}

test('a valid invite code signs a teacher in and lands them on their classes', async ({ page }) => {
  await mockRpc(page, {
    'v1.staff.join': { role: 'teacher', schoolName: 'SMP Negeri 1 Uji', classesTransferred: 0 },
  });

  await page.route('**/session/staff-code', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        assertion: 'a.b.c',
        customId: CUSTOM_ID,
        role: 'teacher',
        schoolName: 'SMP Negeri 1 Uji',
      }),
    }),
  );

  // Nakama's own authenticate endpoint, which is not an RPC and so is not
  // covered by the RPC interception.
  await page.route('**/v2/account/authenticate/custom**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionBody()),
    }),
  );

  await page.goto('/#/signin');
  await page.getByRole('textbox').fill('HM2BT3S5T9');
  await page.getByRole('button', { name: /masuk|sign in/i }).click();

  await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
  await expect(page.getByText('Kelas 8A')).toBeVisible();
});

test('the code is upper-cased as it is typed', async ({ page }) => {
  // It is issued in capitals and read off a note or down a phone line. Being
  // told a correct code is wrong because of its case is an avoidable dead end.
  await page.goto('/#/signin');

  const field = page.getByRole('textbox');
  await field.fill('hm2bt3s5t9');
  await expect(field).toHaveValue('HM2BT3S5T9');
});

test('a spent or unknown code is told apart from an unreachable service', async ({ page }) => {
  await page.route('**/session/staff-code', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_code' }),
    }),
  );

  await page.goto('/#/signin');
  await page.getByRole('textbox').fill('WRONGCODE1');
  await page.getByRole('button', { name: /masuk|sign in/i }).click();

  // Names the code, because the next action is to look at it again or ask for
  // another one — not to check the network.
  await expect(page.getByText(/kode itu tidak berlaku|code is not valid/i)).toBeVisible();
});

test('an unreachable verifier says so, rather than blaming the code', async ({ page }) => {
  await page.route('**/session/staff-code', (route) => route.abort('failed'));

  await page.goto('/#/signin');
  await page.getByRole('textbox').fill('HM2BT3S5T9');
  await page.getByRole('button', { name: /masuk|sign in/i }).click();

  await expect(page.getByText(/koneksi|connection/i)).toBeVisible();
});

test('too many attempts is its own message, because waiting is the only fix', async ({ page }) => {
  await page.route('**/session/staff-code', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'too_many_attempts' }),
    }),
  );

  await page.goto('/#/signin');
  await page.getByRole('textbox').fill('HM2BT3S5T9');
  await page.getByRole('button', { name: /masuk|sign in/i }).click();

  await expect(page.getByText(/terlalu banyak|too many/i)).toBeVisible();
});
