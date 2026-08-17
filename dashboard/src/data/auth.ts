/**
 * Teacher sign-in.
 *
 * The same chain as the app (TRD-TCH-001, ADR-004), and now the same *code*
 * shape too: an invite issued by somebody who already holds authority, in place
 * of a code sent to an inbox. Nothing in this system reads a mailbox any more.
 *
 *   code ─▶ verifier /session/staff-code   (asks Nakama, provisions an identity)
 *        ─▶ authenticateCustom             (the hook checks the assertion)
 *        ─▶ v1.staff.join                  (redeems the invite, sets the role)
 *
 * The dashboard is a second client of that chain, not a second implementation
 * of it. In particular, **nothing here decides whether the account is a
 * teacher.** The invite carries the role, the server writes it, and every
 * request afterwards reads it from the server; a dashboard that decided the
 * role itself would be one refactor from being the only thing checking it.
 */

import { client, clearSession, persistSession, rpc } from './nakama';
import { config } from './config';

interface StaffCodeResponse {
  assertion: string;
  customId: string;
  role: string;
  schoolName: string | null;
}

export class SignInError extends Error {
  /** What the verifier said, when it said something a person can act on. */
  readonly detail: string | undefined;

  constructor(message: string, detail?: string) {
    super(message);
    this.name = 'SignInError';
    this.detail = detail;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.verifierUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SignInError('verifier unreachable', 'unreachable');
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const parsed = (await response.json()) as { error?: unknown };
      if (typeof parsed?.error === 'string') detail = parsed.error;
    } catch {
      detail = undefined;
    }
    throw new SignInError(`verifier ${path} returned ${response.status}`, detail);
  }
  return (await response.json()) as T;
}

/**
 * A browser identifier, for the rate limit that guards code guessing.
 *
 * The limit keys on a device rather than a user because this path runs before
 * an account exists. It is a random string with nothing derived from the
 * machine in it — fingerprinting a teacher's laptop to rate-limit them would be
 * collecting more than the problem needs.
 */
const DEVICE_KEY = 'lenterra.dashboard.device';

function deviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, created);
  return created;
}

export interface StaffSession {
  role: string;
  schoolName: string | null;
  /** Classes carried across when the invite transferred an existing account. */
  classesTransferred: number;
}

/**
 * Redeem a staff invite and sign in.
 *
 * Redeeming happens *after* authentication, not before, because redeeming is
 * what writes the role and there is no account to write it to until the
 * assertion has been presented. The invite is spent by the server inside a
 * single conditional UPDATE, so a double-submitted form cannot spend it twice.
 */
export async function signInWithStaffCode(code: string): Promise<StaffSession> {
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length === 0) throw new SignInError('no code', 'missing_code');

  const result = await postJson<StaffCodeResponse>('/session/staff-code', {
    code: trimmed,
    deviceId: deviceId(),
  });

  // The assertion travels in `vars`, which is what `beforeAuthenticateCustom`
  // reads before it will mint a session.
  const session = await client.authenticateCustom(result.customId, true, undefined, {
    assertion: result.assertion,
    authStrategy: 'staff_code',
  });
  persistSession(session);

  const joined = await rpc<{
    role: string;
    schoolName: string | null;
    classesTransferred: number;
  }>('v1.staff.join', { code: trimmed, idempotencyKey: crypto.randomUUID() });

  return {
    role: joined.role,
    schoolName: joined.schoolName,
    classesTransferred: joined.classesTransferred,
  };
}

export interface TeacherProfile {
  userId: string;
  displayName: string;
  role: string;
  schoolId: string | null;
}

/** Who the server says this session is. Never inferred locally. */
export async function loadProfile(): Promise<TeacherProfile> {
  const bootstrap = await rpc<{ profile: TeacherProfile }>('v1.session.bootstrap', {
    clientVersion: config.buildVersion,
    coreVersion: '0.1.0',
  });
  return bootstrap.profile;
}

export function isTeacherRole(role: string): boolean {
  return role === 'teacher' || role === 'school_admin' || role === 'staff';
}

export function signOut(): void {
  clearSession();
}
