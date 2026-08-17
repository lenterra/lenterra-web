/**
 * The dashboard's connection to the server.
 *
 * The same Nakama RPCs the student app calls, over the same authorisation
 * model. There is no dashboard-specific API service, and that is deliberate:
 * a second API would mean a second implementation of "may this teacher read
 * this class", and duplicated authorisation is how a teacher ends up able to
 * read another school's children's data (TRD-TCH-001).
 *
 * Nothing here decides what a teacher may see. Hiding a control in the UI is
 * never the mechanism that prevents access; the server refuses, and this
 * surfaces the refusal.
 */

import { Client, Session } from '@heroiclabs/nakama-js';

import { config } from './config';

export const client = new Client(
  config.nakama.serverKey,
  config.nakama.host,
  config.nakama.port,
  config.nakama.useSsl,
);

const SESSION_KEY = 'lenterra.dashboard.session';

/** Refresh six hours before expiry, matching the app. */
const REFRESH_WINDOW_SECONDS = 6 * 60 * 60;

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_ARGUMENT'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'CATALOG_STALE'
  | 'UNAVAILABLE'
  | 'OFFLINE';

export class RpcError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.details = details;
  }

  get retryable(): boolean {
    return this.code === 'UNAVAILABLE' || this.code === 'OFFLINE' || this.code === 'RATE_LIMITED';
  }
}

interface StoredSession {
  token: string;
  refreshToken: string;
}

let current: Session | null = null;

export function persistSession(session: Session): void {
  current = session;
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: session.token, refreshToken: session.refresh_token ?? '' }),
  );
}

export function loadSession(): Session | null {
  if (current) return current;

  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as StoredSession;
    current = Session.restore(stored.token, stored.refreshToken);
    return current;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession(): void {
  current = null;
  localStorage.removeItem(SESSION_KEY);
}

let refreshInFlight: Promise<Session | null> | null = null;

export async function ensureSession(): Promise<Session | null> {
  const session = loadSession();
  if (!session) return null;

  const expiresAt = session.expires_at ?? 0;
  if (expiresAt - Math.floor(Date.now() / 1000) > REFRESH_WINDOW_SECONDS) return session;

  // One refresh at a time: several polling queries waking together would
  // otherwise each try, and the losers would refresh with a rotated token.
  if (!refreshInFlight) {
    refreshInFlight = client
      .sessionRefresh(session)
      .then((refreshed) => {
        persistSession(refreshed);
        return refreshed;
      })
      .catch(() => session)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

interface Envelope {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

const KNOWN_CODES: ErrorCode[] = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INVALID_ARGUMENT',
  'VALIDATION_FAILED',
  'CONFLICT',
  'RATE_LIMITED',
  'CATALOG_STALE',
  'UNAVAILABLE',
];

function toCode(value: string): ErrorCode {
  return (KNOWN_CODES as string[]).includes(value) ? (value as ErrorCode) : 'UNAVAILABLE';
}

/**
 * Call an RPC.
 *
 * @throws RpcError — always, so every caller handles one error shape.
 */
export async function rpc<T>(name: string, payload: unknown = {}): Promise<T> {
  const session = await ensureSession();
  if (!session) throw new RpcError('UNAUTHENTICATED', 'No session');

  let raw: string;
  try {
    const response = await client.rpc(session, name, payload as object);
    raw =
      typeof response.payload === 'string'
        ? response.payload
        : JSON.stringify(response.payload ?? {});
  } catch (err) {
    // A transport failure is not a server rejection. Conflating them would
    // make the dashboard show "forbidden" to a teacher on a dropped wifi.
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) throw new RpcError('UNAUTHENTICATED', 'Session rejected');
    throw new RpcError('OFFLINE', 'Could not reach the server');
  }

  let envelope: Envelope;
  try {
    envelope = JSON.parse(raw) as Envelope;
  } catch {
    throw new RpcError('UNAVAILABLE', 'Unreadable response');
  }

  if (!envelope.ok) {
    const error = envelope.error ?? { code: 'UNAVAILABLE', message: 'Unknown error' };
    throw new RpcError(toCode(error.code), error.message, error.details);
  }

  return envelope.data as T;
}
