import { useState } from 'react'
import Window from '../Window'
import LayoutPicker from './LayoutPicker'
import CameraStage from './CameraStage'
import Editor from './Editor'
import FloatingDeco from '../FloatingDeco'
import type { Template } from '../../lib/strip'

type Step = 'layout' | 'camera' | 'edit'

export default function Booth({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState<Step>('layout')
  const [template, setTemplate] = useState<Template | null>(null)
  const [frames, setFrames] = useState<HTMLCanvasElement[]>([])

  return (
    <div className="relative min-h-screen p-3 sm:p-6 flex items-center justify-center overflow-x-hidden">
      {/* Floating pixel clouds & stars background matching Screenshot 2 & 3 */}
      <FloatingDeco />

      <div className="relative z-10 w-full max-w-4xl mx-auto my-auto">
        <Window
          title={step === 'camera' ? 'Camera' : step === 'edit' ? 'Editor' : 'Select'}
          icon={<span className="text-xs">📷</span>}
          className="w-full shadow-2xl overflow-hidden rounded-xl"
          collapsible={false}
          onClose={onExit}
        >
          {step === 'layout' && (
            <LayoutPicker
              onBack={onExit}
              onConfirm={(t) => {
                setTemplate(t)
                setStep('camera')
              }}
            />
          )}
          {step === 'camera' && template && (
            <CameraStage
              template={template}
              onBack={() => setStep('layout')}
              onConfirm={(f) => {
                setFrames(f)
                setStep('edit')
              }}
            />
          )}
          {step === 'edit' && template && (
            <Editor frames={frames} template={template} onRetake={() => setStep('camera')} />
          )}
        </Window>
      </div>
    </div>
  )
}
