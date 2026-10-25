import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export const SETTINGS_KEY = 'ohmlab.settings.v1'

interface Settings {
  animateFlow: boolean
}

interface SettingsApi extends Settings {
  setAnimateFlow: (value: boolean) => void
}

const DEFAULTS: Settings = { animateFlow: true }

function load(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return { animateFlow: typeof stored?.animateFlow === 'boolean' ? stored.animateFlow : DEFAULTS.animateFlow }
  } catch {
    return DEFAULTS
  }
}

const SettingsContext = createContext<SettingsApi | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(load)

  const setAnimateFlow = useCallback((animateFlow: boolean) => {
    setSettings((current) => {
      const next = { ...current, animateFlow }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        // Storage full or blocked: the setting still applies for this session.
      }
      return next
    })
  }, [])

  const api = useMemo(() => ({ ...settings, setAnimateFlow }), [settings, setAnimateFlow])
  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext)
  if (!api) throw new Error('useSettings must be used inside <SettingsProvider>')
  return api
}
