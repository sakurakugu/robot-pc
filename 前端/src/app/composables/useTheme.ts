import { computed, ref } from 'vue'

export type AppTheme = 'light' | 'dark'

const STORAGE_KEY = 'robot-studio-theme'
const theme = ref<AppTheme>('light')
const followSystem = ref(false)
let initialized = false
let mediaQueryList: MediaQueryList | null = null

type StoredThemePreference = {
  theme: AppTheme
  followSystem: boolean
}

function getSystemTheme(): AppTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveStoredPreference(): StoredThemePreference {
  if (typeof window === 'undefined') {
    return {
      theme: 'dark',
      followSystem: false,
    }
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)
  if (!rawValue) {
    return {
      theme: getSystemTheme(),
      followSystem: false,
    }
  }

  if (rawValue === 'light' || rawValue === 'dark') {
    return {
      theme: rawValue,
      followSystem: false,
    }
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredThemePreference>
    const storedTheme = parsed.theme === 'dark' ? 'dark' : 'light'
    return {
      theme: storedTheme,
      followSystem: parsed.followSystem === true,
    }
  } catch {
    return {
      theme: getSystemTheme(),
      followSystem: false,
    }
  }
}

function applyTheme(nextTheme: AppTheme): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.classList.toggle('dark', nextTheme === 'dark')
  root.dataset.theme = nextTheme
  root.style.colorScheme = nextTheme
}

function persistThemePreference(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    theme: theme.value,
    followSystem: followSystem.value,
  } satisfies StoredThemePreference))
}

function handleSystemThemeChange(event: MediaQueryListEvent): void {
  if (!followSystem.value) {
    return
  }

  theme.value = event.matches ? 'dark' : 'light'
  applyTheme(theme.value)
}

function ensureMediaQueryListener(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function' || mediaQueryList) {
    return
  }

  mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQueryList.addEventListener('change', handleSystemThemeChange)
}

function initializeTheme(): void {
  if (initialized) {
    return
  }

  const preference = resolveStoredPreference()
  followSystem.value = preference.followSystem
  theme.value = preference.followSystem ? getSystemTheme() : preference.theme
  applyTheme(theme.value)
  ensureMediaQueryListener()
  initialized = true
}

function setTheme(nextTheme: AppTheme): void {
  initializeTheme()
  followSystem.value = false
  theme.value = nextTheme
  applyTheme(nextTheme)
  persistThemePreference()
}

function setFollowSystem(nextValue: boolean): void {
  initializeTheme()
  followSystem.value = nextValue
  if (nextValue) {
    theme.value = getSystemTheme()
    applyTheme(theme.value)
  }
  persistThemePreference()
}

function toggleTheme(): void {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}

export function useTheme() {
  initializeTheme()

  return {
    theme: computed(() => theme.value),
    isDark: computed(() => theme.value === 'dark'),
    followSystem: computed(() => followSystem.value),
    setTheme,
    setFollowSystem,
    toggleTheme,
    getSystemTheme,
  }
}
