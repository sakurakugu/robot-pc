/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ENABLE_DEVELOPER_SETTINGS_DEFAULT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
