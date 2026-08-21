import { useState, useEffect } from 'react'
import { Settings, RotateCcw } from 'lucide-react'
import Window from '../Window'
import LayoutPicker from './LayoutPicker'
import CameraStage from './CameraStage'
import Editor from './Editor'
import FloatingDeco from '../FloatingDeco'
import { TEMPLATES, type Template } from '../../lib/strip'
import {
  getActiveSessionState,
  saveActiveSessionState,
  clearActiveSessionState,
  dataUrlsToCanvases,
} from '../../lib/sessionRecovery'

type Step = 'layout' | 'camera' | 'edit'

export default function Booth({
  onExit,
  onOpenAdmin,
}: {
  onExit: () => void
  onOpenAdmin?: () => void
}) {
  const [step, setStep] = useState<Step>('layout')
  const [template, setTemplate] = useState<Template | null>(null)
  const [frames, setFrames] = useState<HTMLCanvasElement[]>([])
  const [recoveredToast, setRecoveredToast] = useState(false)

  // Check for active session recovery on mount (e.g. after accidental page reload)
  useEffect(() => {
    async function restoreSession() {
      try {
        const saved = await getActiveSessionState()
        if (saved && saved.rawFrames && saved.rawFrames.length > 0) {
          const foundTmpl = TEMPLATES.find((t) => t.id === saved.templateId) || TEMPLATES[0]
          const canvasFrames = await dataUrlsToCanvases(saved.rawFrames)
          setTemplate(foundTmpl)
          setFrames(canvasFrames)
          setStep('edit')
          setRecoveredToast(true)
          setTimeout(() => setRecoveredToast(false), 4000)
        }
      } catch (err) {
        console.warn('Session recovery error:', err)
      }
    }
    restoreSession()
  }, [])

  const handleExit = async () => {
    await clearActiveSessionState()
    onExit()
  }

  const handleConfirmPhotos = async (f: HTMLCanvasElement[]) => {
    setFrames(f)
    setStep('edit')
    if (template) {
      const dataUrls = f.map((c) => c.toDataURL('image/png'))
      await saveActiveSessionState({
        step: 'edit',
        templateId: template.id,
        rawFrames: dataUrls,
        updatedAt: Date.now(),
      })
    }
  }

  return (
    <div
      className={`relative min-h-screen flex items-center justify-center overflow-x-hidden ${
        step === 'edit' ? 'p-0' : 'p-3 sm:p-6'
      }`}
    >
      {/* Top right Admin shortcut */}
      {onOpenAdmin && (
        <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50">
          <button
            onClick={onOpenAdmin}
            title="Open Admin Studio"
            className="btn95 !px-2.5 !py-1 text-[9px] font-bold flex items-center gap-1 shadow-md bg-white/90"
          >
            <Settings className="w-3 h-3 text-[#5b7fcb]" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        </div>
      )}

      {/* Session Restored Toast Notification */}
      {recoveredToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#8198ed] text-white font-pixel text-xs px-4 py-2 rounded-xl shadow-xl border-2 border-white animate-in slide-in-from-top duration-300 flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Previous session photos restored!</span>
        </div>
      )}

      {/* Floating pixel clouds & stars background */}
      <FloatingDeco />

      {step === 'edit' && template ? (
        <div className="relative z-10 w-full h-screen max-h-screen overflow-hidden">
          <Editor
            frames={frames}
            template={template}
            onRetake={() => {
              setStep('camera')
            }}
            onDone={async () => {
              await clearActiveSessionState()
              setFrames([])
              setTemplate(null)
              setStep('layout')
            }}
          />
        </div>
      ) : step === 'camera' && template ? (
        <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col items-center justify-center p-2 sm:p-4">
          <CameraStage
            template={template}
            onBack={() => setStep('layout')}
            onConfirm={handleConfirmPhotos}
          />
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-7xl px-2 mx-auto my-auto flex flex-col items-center justify-center">
          {step === 'layout' && (
            <LayoutPicker
              onBack={handleExit}
              onConfirm={(t) => {
                setTemplate(t)
                setStep('camera')
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
