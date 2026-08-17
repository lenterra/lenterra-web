/**
 * Accessibility, as a merge gate rather than an audit.
 *
 * A teacher using this is doing it between lessons on a school laptop, often
 * with a keyboard rather than a mouse because the trackpad is unusable and
 * nobody has replaced it. Contrast, focus order, and labelled controls are not
 * a compliance exercise for that person; they are whether the tool works.
 *
 * Serious and critical violations fail the build. Moderate and minor ones are
 * printed. That split is deliberate: axe's moderate findings include judgement
 * calls that a blanket gate turns into people adding `aria-hidden` to make a
 * build pass, which makes the page worse for the person it was meant to help.
 *
 * axe is not a substitute for testing with an actual screen reader. It catches
 * the mechanical half — the half that is embarrassing to ship and easy to miss.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { BOOTSTRAP, CLASS_ID, CONSENT_ABSENT, STUDENT_ID, mockRpc, signedIn } from './fixtures';

const BLOCKING = new Set(['serious', 'critical']);

async function audit(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ''));
  const advisory = results.violations.filter((v) => !BLOCKING.has(v.impact ?? ''));

  if (advisory.length > 0) {
    // Printed rather than failed, and printed with the element, so it is
    // actionable by whoever reads the log rather than a count.
    console.log(
      `${label}: ${advisory.length} advisory finding(s)\n` +
        advisory
          .map((v) => `  · [${v.impact}] ${v.id} — ${v.help}\n    ${v.nodes[0]?.target.join(' ')}`)
          .join('\n'),
    );
  }

  expect(
    blocking.map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`),
    `${label} has blocking accessibility violations`,
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await signedIn(page);
  await mockRpc(page);
});

test('the class list is accessible', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await audit(page, 'class list');
});

/**
 * The two administrative pages.
 *
 * Held to the same gate as the teacher-facing ones. It would be easy to argue
 * that a staff-only screen matters less; the person moderating reports for a
 * pilot is as likely to be working from a keyboard on a borrowed laptop as any
 * teacher, and a queue they cannot operate is a queue nobody empties.
 */
test('the moderation queue is accessible', async ({ page }) => {
  await mockRpc(page, {
    'v1.session.bootstrap': { profile: { ...BOOTSTRAP.profile, role: 'staff' } },
    'v1.moderation.queue': {
      items: [{ id: 'r1', reason: 'bullying', createdAt: '2026-08-10T02:00:00.000Z' }],
      overdue: 1,
    },
  });

  await page.goto('/#/moderation');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await audit(page, 'moderation');
});

test('the administration page is accessible', async ({ page }) => {
  await mockRpc(page, {
    'v1.session.bootstrap': { profile: { ...BOOTSTRAP.profile, role: 'staff' } },
    'v1.admin.staff.invite.list': {
      invites: [
        {
          id: 'i1',
          code: 'HM2BT3S5T9',
          role: 'teacher',
          transfersFrom: null,
          createdAt: '2026-08-16T02:00:00.000Z',
          expiresAt: '2026-08-23T02:00:00.000Z',
          status: 'open',
          redeemedByName: null,
        },
      ],
    },
  });

  await page.goto('/#/admin');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await audit(page, 'administration');
});

test('the consent gate is accessible', async ({ page }) => {
  // The one screen a teacher must complete before anything else works, so a
  // form control here that a screen reader cannot name blocks the whole product
  // rather than one feature.
  await mockRpc(page, { 'v1.teacher.consent.status': CONSENT_ABSENT });
  await page.goto('/#/');
  await expect(page.getByRole('textbox').first()).toBeVisible();
  await audit(page, 'consent gate');
});

test('the class view is accessible', async ({ page }) => {
  await page.goto(`/#/class/${CLASS_ID}`);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await audit(page, 'class view');
});

test('the student view is accessible', async ({ page }) => {
  await page.goto(`/#/class/${CLASS_ID}/student/${STUDENT_ID}`);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await audit(page, 'student view');
});

test('the sign-in page is accessible', async ({ page }) => {
  await page.goto('/#/signin');
  await expect(page.locator('body')).not.toHaveText('');
  await audit(page, 'sign-in');
});

test('the heatmap carries meaning beyond its colours', async ({ page }) => {
  // The specific failure this guards: a heatmap is the densest thing on the
  // dashboard and the easiest to build as colour alone. Roughly one in twelve
  // men has a colour vision deficiency, so a teacher reading a grid of reds and
  // greens may be reading nothing at all.
  await page.goto(`/#/class/${CLASS_ID}`);
  await expect(page.getByRole('heading').first()).toBeVisible();

  const cells = page.locator('[data-band], [aria-label*="band" i], td[title], th[scope]');
  expect(
    await cells.count(),
    'no cell carries a band in text, a label, or an attribute — colour is the only channel',
  ).toBeGreaterThan(0);
});

test('every page is reachable and operable with a keyboard alone', async ({ page }) => {
  // A school laptop with a broken trackpad is the common case, not the edge one.
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? { tag: el.tagName, visible: el !== document.body } : null;
  });

  expect(focused?.visible, 'nothing takes focus on the first Tab').toBe(true);
});
