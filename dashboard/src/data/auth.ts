/**
 * Teacher sign-in.
 *
 * The same chain as the app (TRD-TCH-001, ADR-004): thirdweb in-app wallet
 * proves control of a key by signing a challenge, the verifier turns that proof
 * into a short-lived assertion, and Nakama's `beforeAuthenticateCustom` hook
 * checks the assertion — including that its subject matches the account being
 * claimed.
 *
 * The dashboard is a second client of that chain, not a second implementation
 * of it. In particular, **nothing here decides whether the account is a
 * teacher.** Role comes from the server on every request; a dashboard that
 * checked the role itself would be one refactor away from being the only thing
 * checking it.
 */

import { client, clearSession, persistSession, rpc } from './nakama';
import { config } from './config';

interface ChallengeResponse {
  payload: unknown;
}

interface AssertionResponse {
  assertion: string;
  address: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${config.verifierUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`verifier ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Sign in, given a wallet that has already been connected.
 *
 * The wallet handling itself lives in the caller because thirdweb's web SDK
 * owns the email-code UI; this is the part that is ours.
 */
export async function completeSignIn(signer: {
  address: string;
  signMessage: (message: string) => Promise<string>;
}): Promise<void> {
  const challenge = await postJson<ChallengeResponse>('/session/challenge', {
    address: signer.address,
  });

  // The signature is over the verifier's payload, so the verifier is the only
  // party that decides what was signed. A client-composed message would let a
  // caller sign something else entirely and present it as a login.
  const signature = await signer.signMessage(JSON.stringify(challenge.payload));

  const { assertion, address } = await postJson<AssertionResponse>('/session', {
    payload: challenge.payload,
    signature,
  });

  // `address` comes from the *verified* payload, never from what we sent.
  // (id, create, username, vars) — the assertion travels in `vars`, which is
  // what `beforeAuthenticateCustom` reads before it will mint a session.
  const session = await client.authenticateCustom(address, true, undefined, {
    assertion,
    authStrategy: 'email',
  });
  persistSession(session);
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
