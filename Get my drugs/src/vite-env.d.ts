/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend API, e.g. http://localhost:3001 */
  readonly VITE_API_URL?: string;
  /** Set to "false" to call the real backend instead of mock data */
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
