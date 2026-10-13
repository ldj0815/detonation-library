import { useState } from 'react'
import { useAdmin } from '../context/AdminContext'

interface Props {
  onClose: () => void
}

export default function AdminLogin({ onClose }: Props) {
  const { login } = useAdmin()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(password)
      onClose()
    } catch {
      setError('Invalid password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl p-6 w-80"
      >
        <h2 className="text-lg font-bold text-uci-dark-blue mb-4">Admin Login</h2>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter admin password"
          autoFocus
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:border-uci-blue"
        />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-3 py-2 rounded border border-gray-300 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={loading || !password} className="flex-1 px-3 py-2 rounded bg-uci-blue text-white text-sm font-semibold disabled:opacity-40">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </form>
    </div>
  )
}
