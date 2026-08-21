import { useState, useEffect } from 'react'
import { Lock, ShieldCheck, KeyRound, X, ArrowRight } from 'lucide-react'

export const DEFAULT_PASSCODE = '2026'
export const PASSCODE_STORAGE_KEY = 'itguild_admin_passcode'
export const AUTH_SESSION_KEY = 'itguild_admin_authenticated'

export function getStoredPasscode(): string {
  if (typeof window === 'undefined') return DEFAULT_PASSCODE
  return localStorage.getItem(PASSCODE_STORAGE_KEY) || DEFAULT_PASSCODE
}

export function setStoredPasscode(code: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PASSCODE_STORAGE_KEY, code)
  }
}

export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true'
}

export function setAdminAuthenticated(auth: boolean) {
  if (typeof window !== 'undefined') {
    if (auth) {
      sessionStorage.setItem(AUTH_SESSION_KEY, 'true')
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEY)
    }
  }
}

type Props = {
  onSuccess: () => void
  onCancel?: () => void
}

export default function AdminPasscodeModal({ onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const targetPasscode = getStoredPasscode()

    if (pin.trim() === targetPasscode.trim()) {
      setAdminAuthenticated(true)
      onSuccess()
    } else {
      setError(true)
      setShake(true)
      setPin('')
      setTimeout(() => setShake(false), 500)
    }
  }

  const handleKeypadPress = (digit: string) => {
    setError(false)
    if (pin.length < 8) {
      const next = pin + digit
      setPin(next)
      if (next.length === getStoredPasscode().length) {
        if (next === getStoredPasscode()) {
          setAdminAuthenticated(true)
          onSuccess()
        }
      }
    }
  }

  const handleDelete = () => {
    setError(false)
    setPin((p) => p.slice(0, -1))
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div
        className={`bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center transition-transform ${
          shake ? 'animate-shake translate-x-[-8px]' : ''
        }`}
      >
        {/* Close button if optional cancel */}
        {onCancel && (
          <div className="w-full flex justify-end">
            <button
              onClick={onCancel}
              className="size-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Lock Icon */}
        <div className="size-16 rounded-2xl bg-gradient-to-tr from-[#5b6fbc] to-[#8198ed] text-white flex items-center justify-center shadow-lg shadow-[#8198ed]/30 mb-4">
          <KeyRound className="w-8 h-8" />
        </div>

        {/* Title */}
        <h2 className="font-pixel text-lg sm:text-xl text-[#5b7fcb] tracking-wider mb-1">
          Admin Portal Gate
        </h2>
        <p className="font-pixel text-[9px] text-[#8792c4] tracking-widest uppercase mb-6">
          Enter Passcode to Enter
        </p>

        {/* PIN Indicators Dots */}
        <div className="flex items-center gap-3 mb-6">
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < pin.length
            return (
              <div
                key={idx}
                className={`size-4 rounded-full transition-all duration-200 ${
                  filled
                    ? 'bg-[#5b7fcb] scale-125 shadow-md shadow-[#8198ed]/50'
                    : 'bg-slate-200 border border-slate-300'
                }`}
              />
            )
          })}
        </div>

        {/* Secret Form Input */}
        <form onSubmit={handleSubmit} className="w-full mb-4">
          <input
            type="password"
            autoFocus
            maxLength={12}
            value={pin}
            onChange={(e) => {
              setError(false)
              setPin(e.target.value)
            }}
            placeholder="Enter passcode..."
            className="w-full bg-[#f8fafc] border border-slate-200 focus:border-[#8198ed] focus:ring-2 focus:ring-[#8198ed]/20 rounded-xl px-4 py-2.5 text-center font-mono text-base tracking-widest outline-none shadow-xs text-slate-800"
          />
        </form>

        {/* Error message */}
        {error && (
          <p className="text-xs text-rose-500 font-bold mb-4 font-mono animate-bounce">
            Incorrect passcode. Please try again.
          </p>
        )}

        {/* Numerical On-Screen Keypad */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeypadPress(digit)}
              className="h-12 rounded-xl bg-slate-50 hover:bg-[#eef2ff] hover:text-[#5b7fcb] font-mono text-lg font-bold text-slate-700 border border-slate-200 transition-all active:scale-95 shadow-xs cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleDelete}
            className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 font-mono text-xs font-bold text-slate-600 border border-slate-200 transition-all active:scale-95 shadow-xs cursor-pointer flex items-center justify-center"
          >
            DEL
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress('0')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-[#eef2ff] hover:text-[#5b7fcb] font-mono text-lg font-bold text-slate-700 border border-slate-200 transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            className="h-12 rounded-xl bg-[#8198ed] hover:bg-[#5b6fbc] text-white font-mono text-sm font-bold transition-all active:scale-95 shadow-md shadow-[#8198ed]/30 cursor-pointer flex items-center justify-center"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[10px] text-slate-400 font-mono">
          Default Passcode: <span className="font-bold text-[#8198ed]">2026</span>
        </p>
      </div>
    </div>
  )
}
