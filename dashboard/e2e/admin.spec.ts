/**
 * Moderation and administration.
 *
 * Both pages exist because their RPCs had no caller: a child's report reached a
 * queue nobody could open, and a teacher account was created by writing SQL.
 *
 * What is checked here is mostly what these pages must *not* do. A moderation
 * queue that named the children in it would be a list of reported minors on a
 * screen in a staff room, and an invite code that could not be read back once
 * shown would strand the administrator who looked away.
 */

import { expect, test } from '@playwright/test';

import { BOOTSTRAP, mockRpc, signedIn } from './fixtures';

const ADMIN = {
  profile: { ...BOOTSTRAP.profile, role: 'staff', displayName: 'Admin Uji' },
};

const QUEUE = {
  items: [
    { id: 'report-1', reason: 'bullying', createdAt: '2026-08-10T02:00:00.000Z' },
    { id: 'report-2', reason: 'impersonation', createdAt: '2026-08-16T02:00:00.000Z' },
  ],
  overdue: 1,
};

const INVITES = {
  invites: [
    {
      id: 'invite-1',
      code: 'HM2BT3S5T9',
      role: 'teacher',
      transfersFrom: null,
      createdAt: '2026-08-16T02:00:00.000Z',
      expiresAt: '2026-08-23T02:00:00.000Z',
      status: 'open',
      redeemedByName: null,
    },
    {
      id: 'invite-2',
      code: null,
      role: 'school_admin',
      transfersFrom: null,
      createdAt: '2026-08-01T02:00:00.000Z',
      expiresAt: '2026-08-08T02:00:00.000Z',
      status: 'redeemed',
      redeemedByName: 'Ibu Ratu',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await signedIn(page);
});

test('a report can be read and resolved', async ({ page }) => {
  const resolved: unknown[] = [];
  await mockRpc(page, {
    'v1.session.bootstrap': ADMIN,
    'v1.moderation.queue': QUEUE,
    'v1.moderation.resolve': (payload: unknown) => {
      resolved.push(payload);
      return { resolved: true };
    },
  });

  await page.goto('/#/moderation');

  // Categories, translated. A moderator reads "Perundungan", not `bullying` —
  // an untranslated enum on this page would be the clearest sign nobody has
  // ever opened it.
  await expect(page.getByText('Perundungan')).toBeVisible();
  await expect(page.getByText('bullying')).toHaveCount(0);

  await page.getByRole('button', { name: /ditindaklanjuti|actioned/i }).first().click();
  await expect.poll(() => resolved.length).toBeGreaterThan(0);
  expect((resolved[0] as { action: string }).action).toBe('actioned');
});

test('the queue names nobody', async ({ page }) => {
  // Neither the reporter nor the reported. A moderator judging whether a
  // category of report is real does not need a child's name to do it, and a
  // list of reported minors is a list that gets read over a shoulder.
  await mockRpc(page, {
    'v1.session.bootstrap': ADMIN,
    'v1.moderation.queue': QUEUE,
  });

  await page.goto('/#/moderation');
  await expect(page.getByText(/perundungan/i)).toBeVisible();

  const body = (await page.locator('body').textContent()) ?? '';
  for (const name of ['Ani', 'Rizky', 'Yosef', 'Maria', 'Bagus', 'Putri']) {
    expect(body).not.toContain(name);
  }
});

test('a missed 72-hour commitment is shown, not only logged', async ({ page }) => {
  await mockRpc(page, {
    'v1.session.bootstrap': ADMIN,
    'v1.moderation.queue': QUEUE,
  });

  await page.goto('/#/moderation');
  await expect(page.getByText(/72/)).toBeVisible();
});

test('an invite is issued and its code shown in full', async ({ page }) => {
  await mockRpc(page, {
    'v1.session.bootstrap': ADMIN,
    'v1.admin.staff.invite.list': INVITES,
    'v1.admin.staff.invite': {
      inviteId: 'invite-3',
      code: 'PQ7XK4M2NB',
      role: 'teacher',
      schoolId: 'school-1',
      expiresAt: '2026-08-24T02:00:00.000Z',
    },
  });

  await page.goto('/#/admin');
  await page.getByRole('button', { name: /buat undangan|create invite/i }).click();

  // Shown once and never again after redemption, so it has to be complete and
  // readable rather than truncated.
  await expect(page.getByText('PQ7XK4M2NB')).toBeVisible();
});

test('a spent invite shows no code to copy', async ({ page }) => {
  // The server returns null for anything already redeemed, revoked, or expired.
  // Rendering a stale code would invite somebody to hand out a dead one.
  await mockRpc(page, {
    'v1.session.bootstrap': ADMIN,
    'v1.admin.staff.invite.list': INVITES,
  });

  await page.goto('/#/admin');
  await expect(page.getByText('HM2BT3S5T9')).toBeVisible();
  await expect(page.getByText(/terpakai|used/i)).toBeVisible();
});

test('a teacher is not offered moderation or administration', async ({ page }) => {
  // A courtesy rather than a control — the server refuses either way — but a
  // teacher who follows a link into a refusal learns nothing useful.
  await mockRpc(page);
  await page.goto('/#/');

  await expect(page.getByRole('link', { name: /laporan|reports/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /administrasi|administration/i })).toHaveCount(0);
});

test('a refused queue read shows a refusal rather than an empty list', async ({ page }) => {
  // An empty moderation queue and a forbidden one look identical if the error
  // is swallowed, and "no reports" is exactly the wrong thing to tell somebody
  // who cannot see them.
  await mockRpc(page, {
    'v1.session.bootstrap': ADMIN,
    'v1.moderation.queue': { error: { code: 'FORBIDDEN', message: 'Not permitted' } },
  });

  await page.goto('/#/moderation');
  await expect(page.getByText(/tidak ada laporan terbuka|no open reports/i)).toHaveCount(0);
});
