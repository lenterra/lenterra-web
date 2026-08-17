/// <reference types="vite/client" />

/**
 * Build-time configuration.
 *
 * Declared explicitly rather than falling back to `any`, so a typo in an env
 * name is a compile error rather than an undefined at runtime that only shows
 * up as a failed connection in production.
 */
interface ImportMetaEnv {
  readonly VITE_NAKAMA_HOST: string;
  readonly VITE_NAKAMA_PORT?: string;
  readonly VITE_NAKAMA_SERVER_KEY: string;
  readonly VITE_NAKAMA_USE_SSL?: string;
  readonly VITE_VERIFIER_URL: string;
  readonly VITE_BUILD_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
