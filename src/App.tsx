import { useState } from 'react'
import Desktop from './components/Desktop'
import Booth from './components/booth/Booth'

export default function App() {
  const [view, setView] = useState<'desktop' | 'booth'>('desktop')

  return view === 'desktop' ? (
    <Desktop onStart={() => setView('booth')} />
  ) : (
    <Booth onExit={() => setView('desktop')} />
  )
}
