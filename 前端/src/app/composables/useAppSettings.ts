import { computed, ref } from 'vue'

const STORAGE_KEY = 'robot-pc-app-settings'

type AppSettings = {
  developerSettingsEnabled: boolean
}

const developerSettingsDefaultEnabled = resolveBooleanEnv(import.meta.env.VITE_ENABLE_DEVELOPER_SETTINGS_DEFAULT)
const developerSettingsEnabled = ref(developerSettingsDefaultEnabled)
let initialized = false

function resolveBooleanEnv(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value !== 'string') {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function resolveStoredSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return {
      developerSettingsEnabled: developerSettingsDefaultEnabled,
    }
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)
  if (!rawValue) {
    return {
      developerSettingsEnabled: developerSettingsDefaultEnabled,
    }
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AppSettings>
    return {
      developerSettingsEnabled: parsed.developerSettingsEnabled === true,
    }
  } catch {
    return {
      developerSettingsEnabled: developerSettingsDefaultEnabled,
    }
  }
}

function persistSettings(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    developerSettingsEnabled: developerSettingsEnabled.value,
  } satisfies AppSettings))
}

function initializeAppSettings(): void {
  if (initialized) {
    return
  }

  const settings = resolveStoredSettings()
  developerSettingsEnabled.value = settings.developerSettingsEnabled
  initialized = true
}

function setDeveloperSettingsEnabled(nextValue: boolean): void {
  initializeAppSettings()
  developerSettingsEnabled.value = nextValue
  persistSettings()
}

function resetAppSettings(): void {
  initializeAppSettings()
  developerSettingsEnabled.value = developerSettingsDefaultEnabled
  persistSettings()
}

export function useAppSettings() {
  initializeAppSettings()

  return {
    developerSettingsEnabled: computed(() => developerSettingsEnabled.value),
    developerSettingsDefaultEnabled,
    setDeveloperSettingsEnabled,
    resetAppSettings,
  }
}
