/**
 * A synthetic class, and the plumbing that puts it behind the dashboard's RPCs.
 *
 * Every name here is invented and every number is made up, which is the rule
 * for test data everywhere in this product (TRD-SEC-013): there is no path by
 * which a real student's record reaches a test environment, because nobody has
 * a reason to want one there.
 *
 * The interception happens at the transport rather than at the module boundary.
 * `nakama-js` posts to `/v2/rpc/{name}`, so intercepting that URL exercises the
 * dashboard's real client — its envelope parsing, its error codes, its retry
 * rules — instead of replacing them with a stub that agrees with itself.
 */

import type { Page, Route } from '@playwright/test';

export const CLASS_ID = '7f0c9a52-4e11-4f7a-9b31-2c5a6d8e0011';
export const STUDENT_ID = 'b21d3f88-7a4c-4d2e-8f19-33ac5e7b9902';

const NODES = ['comp.counting', 'comp.modular', 'algo.sequencing', 'algo.greedy', 'sec.assets'];

const BANDS = ['not_started', 'emerging', 'developing', 'proficient', 'mastered'] as const;

const NAMES = [
  'Ani Ratu',
  'Rizky Bela',
  'Yosef Tanu',
  'Maria Dael',
  'Bagus Lede',
  'Putri Wangi',
];

/**
 * A roster with a believable spread of ability.
 *
 * Deliberately not uniform: a heatmap where everybody sits in the same band
 * renders as a solid block and would pass a test that a real class would fail.
 */
function heatmap() {
  return NAMES.map((displayName, student) => ({
    userId: student === 0 ? STUDENT_ID : `student-${student}`,
    displayName,
    nodes: NODES.map((skillNodeId, node) => {
      const band = BANDS[(student + node) % BANDS.length]!;
      return {
        skillNodeId,
        mastery: 0.15 + ((student * 7 + node * 13) % 80) / 100,
        band,
        evidenceCount: band === 'not_started' ? 0 : 3 + ((student + node) % 9),
      };
    }),
  }));
}

export const CLASSES = {
  classes: [
    { id: CLASS_ID, name: 'Kelas 8A', level: 'SMP', students: NAMES.length, joinCode: 'K8ANEW' },
  ],
};

export const CONSENT_RECORDED = {
  recorded: true,
  kind: 'school_participation',
  confirmedAt: '2026-02-03T02:00:00.000Z',
  processNote: 'Formulir persetujuan ditandatangani wali murid pada rapat awal semester.',
};

export const CONSENT_ABSENT = { recorded: false, kind: null, confirmedAt: null, processNote: null };

export const SUMMARY = {
  generatedAt: '2026-08-17T01:00:00.000Z',
  participation: { enrolled: NAMES.length, activeThisPeriod: 4, medianAttempts: 12, medianMinutes: 47 },
  heatmap: heatmap(),
  gaps: [
    {
      skillNodeId: 'comp.modular',
      studentsBelowProficient: 4,
      totalStudents: NAMES.length,
      suggestedLessonId: 'comp.modular.l01',
      suggestedMissionIds: ['congklak.m04'],
      teaching: {
        misconception: 'Siswa menghitung sisa bagi dengan mengurangi berulang dan kehilangan hitungan.',
        howToTeach: 'Mulai dari lubang congklak: tunjukkan bahwa putaran penuh selalu kembali ke titik yang sama.',
      },
    },
  ],
  // Present, because a teacher looking at a number that is about to change
  // should be told so before they act on it.
  unsyncedWarning: { studentsWithStaleData: 2 },
};

export const ROSTER = {
  classId: CLASS_ID,
  joinCode: 'K8ANEW',
  joinCodeExpiresAt: '2026-08-31T00:00:00.000Z',
  students: NAMES.map((displayName, i) => ({
    userId: i === 0 ? STUDENT_ID : `student-${i}`,
    displayName,
    joinedAt: '2026-08-01T02:00:00.000Z',
    lastActiveAt: i < 4 ? '2026-08-16T07:30:00.000Z' : null,
    attempts: 20 - i * 3,
  })),
  pendingReclaims: [{ requestId: 'reclaim-1', maskedName: 'Y••••f T•••', requestedAt: '2026-08-15T01:00:00.000Z' }],
};

export const ATTENTION = {
  students: [
    {
      userId: STUDENT_ID,
      displayName: NAMES[0]!,
      reason: 'repeated_struggle',
      reasonKey: 'attention.reason.repeated_struggle',
      params: { node: 'comp.modular', failures: '3' },
      suggestedAction: { kind: 'assign_lesson', targetId: 'comp.modular.l01' },
      urgency: 0.9,
    },
    {
      userId: 'student-4',
      displayName: NAMES[4]!,
      reason: 'never_started',
      reasonKey: 'attention.reason.never_started',
      params: {},
      suggestedAction: { kind: 'talk' },
      urgency: 0.6,
    },
  ],
};

export const STUDENT = {
  student: {
    userId: STUDENT_ID,
    displayName: NAMES[0]!,
    joinedAt: '2026-08-01T02:00:00.000Z',
    lastActiveAt: '2026-08-16T07:30:00.000Z',
  },
  summaryText: {
    strengthKey: 'student.summary.strength',
    nextActionKey: 'student.summary.nextAction',
    params: { strength: 'algo.sequencing', next: 'comp.modular' },
  },
  mastery: NODES.map((skillNodeId, i) => ({
    skillNodeId,
    mastery: 0.2 + i * 0.15,
    band: BANDS[i]!,
    evidenceCount: i === 0 ? 0 : i * 4,
    distinctSources: i === 0 ? 0 : Math.min(3, i),
    trend: (['flat', 'up', 'down', 'up', 'flat'] as const)[i]!,
  })),
  evidence: NODES.slice(0, 2).map((skillNodeId, i) => ({
    skillNodeId,
    events: [
      {
        at: '2026-08-14T03:00:00.000Z',
        missionId: 'congklak.m04',
        outcome: i === 0 ? 'failure' : 'success',
        hintUsed: i === 0,
        masteryBefore: 0.3,
        masteryAfter: i === 0 ? 0.26 : 0.44,
      },
    ],
  })),
  struggles: [
    { skillNodeId: 'comp.modular', detectedAt: '2026-08-14T03:10:00.000Z', resolvedAt: null, failures: 3 },
  ],
  recentAttempts: [
    {
      attemptId: 'attempt-1',
      missionId: 'congklak.m04',
      outcome: 'failure',
      at: '2026-08-14T03:00:00.000Z',
      durationMs: 92_000,
      playedOffline: true,
    },
  ],
  points: 148,
  streakDays: 4,
  certificates: [],
};

type Handlers = Record<string, unknown | ((payload: unknown) => unknown)>;

/**
 * The Shell calls this before any route renders, and treats a failure as signed
 * out. A fixture set without it renders the sign-in page for every test, which
 * is a confusing way to learn that one RPC is missing.
 */
export const BOOTSTRAP = {
  profile: {
    userId: 'teacher-1',
    displayName: 'Ibu Ratu',
    role: 'teacher',
    locale: 'id',
    schoolId: 'school-1',
    schoolName: 'SMP Negeri 1 Uji',
  },
};

const DEFAULTS: Handlers = {
  'v1.session.bootstrap': BOOTSTRAP,
  'v1.teacher.class.list': CLASSES,
  'v1.teacher.consent.status': CONSENT_RECORDED,
  'v1.teacher.class.summary': SUMMARY,
  'v1.teacher.class.roster': ROSTER,
  'v1.teacher.attention.list': ATTENTION,
  'v1.teacher.student.detail': STUDENT,
  'v1.teacher.class.create': { classId: 'new-class-id', joinCode: 'FRESH1' },
  'v1.teacher.consent.record': { consentId: 'consent-1' },
  'v1.teacher.assignment.create': { assignmentId: 'assignment-1' },
};

/**
 * Serve the dashboard's RPCs from fixtures.
 *
 * `overrides` replaces individual handlers, including with a function, so a
 * test can make one call fail without describing the other eight. A handler
 * returning `{ error }` produces the server's error envelope rather than an
 * HTTP failure — which is the distinction the dashboard's retry rules turn on,
 * and getting it wrong here would test the wrong path.
 */
/**
 * Unwrap what Nakama's HTTP RPC actually puts on the wire.
 *
 * The body is a JSON-encoded *string* containing the JSON payload, so one parse
 * yields a string and the second yields the object. Parsing once left every
 * field `undefined` — which no test noticed, because the only assertion against
 * a request body belonged to a test that was skipped.
 */
function decodePayload(raw: string | null): unknown {
  if (!raw) return {};
  try {
    const once = JSON.parse(raw);
    return typeof once === 'string' ? JSON.parse(once) : once;
  } catch {
    return {};
  }
}

export async function mockRpc(page: Page, overrides: Handlers = {}): Promise<string[]> {
  const handlers = { ...DEFAULTS, ...overrides };
  const called: string[] = [];

  await page.route('**/v2/rpc/**', async (route: Route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/v2/rpc/')[1] ?? '');
    called.push(name);

    const handler = handlers[name];
    if (handler === undefined) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          payload: JSON.stringify({
            ok: false,
            error: { code: 'NOT_FOUND', message: `no fixture for ${name}` },
          }),
        }),
      });
    }

    let body: unknown = handler;
    if (typeof handler === 'function') {
      body = (handler as (payload: unknown) => unknown)(
        decodePayload(route.request().postData()),
      );
    }

    const envelope =
      body && typeof body === 'object' && 'error' in (body as object)
        ? { ok: false, error: (body as { error: unknown }).error }
        : { ok: true, data: body };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ payload: JSON.stringify(envelope) }),
    });
  });

  return called;
}

/**
 * Put a signed-in teacher in the browser before the app loads.
 *
 * The token is a syntactically valid JWT with a far-future expiry and nothing
 * real in it. Redeeming a real staff invite would spend one per test — they
 * are single-use by design — so the session is planted rather than earned.
 * What the sign-in path itself does is covered where it belongs, against a
 * verifier that can be told to fail.
 */
export async function signedIn(page: Page): Promise<void> {
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

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    ['lenterra.dashboard.session', JSON.stringify({ token, refreshToken: token })],
  );
}
