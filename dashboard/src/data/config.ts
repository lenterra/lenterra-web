/**
 * Environment configuration.
 *
 * Injected at build time, never committed (TRD-CICD-006). The Nakama server key
 * is not a secret in the usual sense — every client holds it — but it is still
 * injected, so pointing at staging is a build variable rather than a source
 * edit somebody eventually forgets to revert.
 *
 * Missing values throw at module load rather than degrading. A dashboard that
 * starts and then fails every request looks like a server outage to the one
 * person who cannot investigate it.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `${name} is not set. The dashboard cannot start without it — see dashboard/.env.example.`,
    );
  }
  return value;
}

const env = import.meta.env;

export const config = {
  nakama: {
    host: required('VITE_NAKAMA_HOST', env.VITE_NAKAMA_HOST),
    port: env.VITE_NAKAMA_PORT ?? '7350',
    serverKey: required('VITE_NAKAMA_SERVER_KEY', env.VITE_NAKAMA_SERVER_KEY),
    // Anything but a local development host must be TLS (TRD-SEC-005).
    useSsl: (env.VITE_NAKAMA_USE_SSL ?? 'true') !== 'false',
  },
  verifierUrl: required('VITE_VERIFIER_URL', env.VITE_VERIFIER_URL),
  thirdwebClientId: required('VITE_THIRDWEB_CLIENT_ID', env.VITE_THIRDWEB_CLIENT_ID),
  buildVersion: env.VITE_BUILD_VERSION ?? 'dev',
} as const;
