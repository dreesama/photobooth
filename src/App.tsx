import { useState, useEffect } from 'react'
import Desktop from './components/Desktop'
import Booth from './components/booth/Booth'
import AdminDashboard from './components/admin/AdminDashboard'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  const [view, setView] = useState<'desktop' | 'booth' | 'admin'>('desktop')

  // Global keyboard shortcut to open Admin Studio (Ctrl + Shift + A or Alt + A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') || (e.altKey && e.key.toLowerCase() === 'a')) {
        e.preventDefault()
        setView((prev) => (prev === 'admin' ? 'desktop' : 'admin'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <ErrorBoundary>
      {view === 'admin' && (
        <AdminDashboard
          onExit={() => setView('desktop')}
          onStartBooth={() => setView('booth')}
        />
      )}
      {view === 'booth' && (
        <Booth
          onExit={() => setView('desktop')}
          onOpenAdmin={() => setView('admin')}
        />
      )}
      {view === 'desktop' && (
        <Desktop
          onStart={() => setView('booth')}
          onOpenAdmin={() => setView('admin')}
        />
      )}
    </ErrorBoundary>
  )
}
