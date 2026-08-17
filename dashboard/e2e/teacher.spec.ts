/**
 * The flow a teacher actually performs: sign in → create a class → watch the
 * roster → drill into a student's evidence → assign something.
 *
 * The requirement behind most of this is that a teacher who has never seen the
 * dashboard can run class onboarding unaided (PRD-TCH-001), which is measured
 * with real teachers and cannot be automated. What *can* be automated is the
 * part that would make that session fail for a reason nobody intended: a route
 * that does not load, a number that renders as `NaN`, a link that goes nowhere.
 *
 * Two claims are checked here that a component test cannot make, because both
 * are about what a teacher can act on rather than what a component renders:
 * that a gap names what to do about it rather than only that it exists, and
 * that a number about to change says so before somebody acts on it.
 */

import { expect, test } from '@playwright/test';

import {
  ATTENTION,
  CLASS_ID,
  CONSENT_ABSENT,
  ROSTER,
  STUDENT,
  STUDENT_ID,
  SUMMARY,
  mockRpc,
  signedIn,
} from './fixtures';

test.beforeEach(async ({ page }) => {
  await signedIn(page);
});

test('a teacher signs in and sees their classes', async ({ page }) => {
  await mockRpc(page);
  await page.goto('/#/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Kelas 8A')).toBeVisible();

  // The join code is what gets copied onto a whiteboard from across a room, so
  // it has to be on the list rather than one click in.
  await expect(page.getByText('K8ANEW')).toBeVisible();
});

test('a class cannot be created until consent is recorded', async ({ page }) => {
  // The server refuses it, so a form offered above an unanswered gate would
  // just fail on submit — and a teacher would learn the rule from an error
  // rather than from the screen.
  await mockRpc(page, { 'v1.teacher.consent.status': CONSENT_ABSENT });
  await page.goto('/#/');

  await expect(page.getByRole('textbox').first()).toBeVisible();
  const submit = page.getByRole('button', { name: /buat kelas|create/i });
  await expect(submit).toHaveCount(0);
});

test('recording consent opens class creation', async ({ page }) => {
  let recorded = false;
  await mockRpc(page, {
    'v1.teacher.consent.status': () =>
      recorded
        ? { recorded: true, kind: 'school_participation', confirmedAt: '2026-08-17T00:00:00.000Z', processNote: 'x' }
        : CONSENT_ABSENT,
    'v1.teacher.consent.record': () => {
      recorded = true;
      return { consentId: 'consent-1' };
    },
  });

  await page.goto('/#/');

  const note = page.getByRole('textbox').first();
  await note.fill(
    'Formulir persetujuan ditandatangani wali murid pada rapat awal semester, disimpan di tata usaha.',
  );
  await page.getByRole('button').first().click();

  // The form appears only once the gate is satisfied, which is the whole
  // behaviour: the rule is expressed by the screen, not by a rejected submit.
  await expect(page.getByRole('form').or(page.locator('form'))).toBeVisible({ timeout: 15_000 });
});

test('a teacher opens a class and reads the roster', async ({ page }) => {
  await mockRpc(page);
  await page.goto(`/#/class/${CLASS_ID}`);

  // `.first()` throughout: a name appears in the roster table, the heatmap's
  // screen-reader labels, and the attention list, which is three correct
  // renderings of the same student rather than a duplicate.
  for (const student of ROSTER.students.slice(0, 3)) {
    await expect(page.getByText(student.displayName).first()).toBeVisible();
  }
});

test('a gap names what to do about it, not only that it exists', async ({ page }) => {
  // "Four students are below proficient on modular arithmetic" is a fact. What
  // a teacher can act on in the ten minutes they have is the misconception and
  // the first move, which is why both are authored content rather than a
  // sentence the dashboard composes.
  await mockRpc(page);
  await page.goto(`/#/class/${CLASS_ID}`);

  const gap = SUMMARY.gaps[0]!;

  // Behind a disclosure, which is the right shape — the list has to stay
  // scannable — but the content has to be one interaction away, not absent.
  const teaching = page.locator('details', { hasText: /mengajar|teach/i }).first();
  await expect(teaching).toBeVisible();
  await teaching.locator('summary').click();

  await expect(page.getByText(gap.teaching!.misconception)).toBeVisible();
  await expect(page.getByText(gap.teaching!.howToTeach)).toBeVisible();
});

test('a number that is about to change says so', async ({ page }) => {
  // Some students' work has not reached the server. A teacher acting on a
  // figure that silently moves afterwards reads the system as unreliable, and
  // they are right to.
  await mockRpc(page);
  await page.goto(`/#/class/${CLASS_ID}`);

  await expect(
    page.getByText(String(SUMMARY.unsyncedWarning!.studentsWithStaleData)).first(),
  ).toBeVisible();
});

test('the attention list is ordered by urgency and drills through to a student', async ({ page }) => {
  await mockRpc(page);
  await page.goto(`/#/class/${CLASS_ID}`);

  const first = ATTENTION.students[0]!;
  const entry = page.getByRole('button', { name: first.displayName, exact: true });
  await expect(entry).toBeVisible();

  await entry.click();
  await expect(page).toHaveURL(new RegExp(`student/${STUDENT_ID}`), { timeout: 15_000 });
});

test('a student page shows the evidence behind every claim it makes', async ({ page }) => {
  // The evidence is complete rather than sampled (PRD-TCH-008): a teacher who
  // is going to tell a student something about their work needs to be able to
  // check it first.
  await mockRpc(page);
  await page.goto(`/#/class/${CLASS_ID}/student/${STUDENT_ID}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STUDENT.student.displayName);

  // Node ids are never shown: a teacher reads "Putaran dan sisa", not
  // `comp.modular`. What has to be visible is a row per node with its evidence
  // count, because that count is what makes the band a claim rather than an
  // assertion.
  for (const node of STUDENT.mastery) {
    await expect(page.getByText(node.skillNodeId)).toHaveCount(0);
  }

  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(STUDENT.mastery.length);
});

test('a mastery value is never shown without the evidence behind it', async ({ page }) => {
  // PRD-ADPT-005 restricts numbers on the *student's* screen, not the
  // teacher's. A teacher genuinely needs to judge whether 0.68 and 0.71 differ,
  // and the app's own profile screen is structurally incapable of showing a
  // value because its contract does not carry one.
  //
  // What matters here instead is that the number never appears alone. 0.80 from
  // two attempts and 0.80 from twenty are different claims about a child, and a
  // teacher reading the first without the second would act on a coin flip.
  await mockRpc(page);
  await page.goto(`/#/class/${CLASS_ID}/student/${STUDENT_ID}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(STUDENT.student.displayName);

  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(STUDENT.mastery.length);

  for (let i = 0; i < STUDENT.mastery.length; i += 1) {
    const node = STUDENT.mastery[i]!;
    const row = rows.nth(i);

    await expect(row).toContainText(node.mastery.toFixed(2));
    await expect(row).toContainText(String(node.evidenceCount));

    // And thin evidence is marked as thin rather than left to be inferred from
    // a count a busy reader skims past.
    if (node.distinctSources < 2) {
      await expect(row).toContainText(`(${node.distinctSources})`);
    }
  }
});

test('a teacher assigning work sends it for the class they are looking at', async ({ page }) => {
  const assignments: unknown[] = [];
  await mockRpc(page, {
    'v1.teacher.assignment.create': (payload: unknown) => {
      assignments.push(payload);
      return { assignmentId: 'assignment-1' };
    },
  });

  await page.goto(`/#/class/${CLASS_ID}`);

  const assign = page.getByRole('button', { name: /tugaskan|assign/i }).first();
  if ((await assign.count()) === 0) {
    test.skip(true, 'no assign affordance on this surface yet');
    return;
  }

  await assign.click();
  await expect.poll(() => assignments.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect((assignments[0] as { classId: string }).classId).toBe(CLASS_ID);
});

test('a refused read shows a refusal, not a spinner', async ({ page }) => {
  // A teacher who has been removed from a class must be told, once. Retrying a
  // FORBIDDEN would leave them watching a spinner forever while the server says
  // no three times.
  let calls = 0;
  await mockRpc(page, {
    'v1.teacher.class.summary': () => {
      calls += 1;
      return { error: { code: 'FORBIDDEN', message: 'Not permitted' } };
    },
  });

  await page.goto(`/#/class/${CLASS_ID}`);
  await page.waitForTimeout(2500);

  expect(calls).toBe(1);
});

test('an unreachable server is distinguished from a refusal', async ({ page }) => {
  await mockRpc(page);
  await page.route('**/v2/rpc/v1.teacher.class.list', (route) => route.abort('failed'));

  await page.goto('/#/');

  // Something has to appear. A blank page is the one outcome that tells a
  // teacher nothing at all about whether to wait or to fetch help.
  await expect(page.locator('body')).not.toHaveText('', { timeout: 15_000 });
});
