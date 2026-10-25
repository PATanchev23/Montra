/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin for deployments where web and API live on different hosts. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
