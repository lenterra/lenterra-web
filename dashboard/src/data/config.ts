/**
 * Environment configuration.
 *
 * Injected at build time, never committed (TRD-CICD-006). The Nakama server key
 * is not a secret in the usual sense — every client holds it — but it is still
 * injected, so pointing at staging is a build variable rather than a source
 * edit somebody eventually forgets to revert.
 *
 * Every value defaults to production. A build with no environment at all is a
 * build that talks to the real server, which is what a deploy should do — and
 * the previous behaviour, throwing at module load, meant a missing variable
 * produced a dashboard that would not start at all.
 */

/**
 * Where the server is, unless a build says otherwise.
 *
 * The verifier sits behind the same name as Nakama, so there is one DNS record
 * and one certificate rather than two.
 */
const PRODUCTION = {
  host: 'lenterra-api.faizath.com',
  port: '443',
  verifierUrl: 'https://lenterra-api.faizath.com/verifier',
  serverKey: 'lenterra',
} as const;

const env = import.meta.env;

export const config = {
  nakama: {
    host: env.VITE_NAKAMA_HOST ?? PRODUCTION.host,
    port: env.VITE_NAKAMA_PORT ?? PRODUCTION.port,
    serverKey: env.VITE_NAKAMA_SERVER_KEY ?? PRODUCTION.serverKey,
    // Anything but a local development host must be TLS (TRD-SEC-005).
    useSsl: (env.VITE_NAKAMA_USE_SSL ?? 'true') !== 'false',
  },
  verifierUrl: env.VITE_VERIFIER_URL ?? PRODUCTION.verifierUrl,
  buildVersion: env.VITE_BUILD_VERSION ?? 'dev',
} as const;
