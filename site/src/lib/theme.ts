export type Theme = 'light' | 'dark' | 'system'

const KEY = 'theme'

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark') return t
  } catch { /* storage unavailable */ }
  return 'system'
}

export function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
}

export function setTheme(t: Theme) {
  try {
    if (t === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch { /* storage unavailable */ }
  applyTheme(t)
}

/** The theme actually in effect right now: the attribute on <html> (which a
 *  ?theme= query sets without touching storage), else the stored choice, else
 *  the system setting. */
export function resolvedTheme(): 'light' | 'dark' {
  const applied = document.documentElement.getAttribute('data-theme')
  if (applied === 'light' || applied === 'dark') return applied
  const t = getTheme()
  if (t !== 'system') return t
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
