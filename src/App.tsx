import { useState, useEffect } from 'react'
import Desktop from './components/Desktop'
import Booth from './components/booth/Booth'
import AdminDashboard from './components/admin/AdminDashboard'
import ErrorBoundary from './components/ErrorBoundary'
import PublicPortal from './components/PublicPortal'

export default function App() {
  const [view, setView] = useState<'desktop' | 'booth' | 'admin'>('desktop')

  // Detect if the app is being accessed on the public delivery domain (e.g. Railway) vs local booth machine
  const isLocalBooth = (() => {
    if (typeof window === 'undefined') return true
    const host = window.location.hostname
    // Allow localhost, local LAN IPs (192.168.x, 10.x, 172.x), and explicit operator override
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      (host.startsWith('172.') && parseInt(host.split('.')[1] || '0') >= 16)
    ) {
      return true
    }
    // Allow operator bypass with secret query parameter ?operator=1
    const params = new URLSearchParams(window.location.search)
    return params.get('operator') === '1'
  })()

  // Global keyboard shortcut to open Admin Studio (Ctrl + Shift + A or Alt + A)
  useEffect(() => {
    if (!isLocalBooth) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') || (e.altKey && e.key.toLowerCase() === 'a')) {
        e.preventDefault()
        setView((prev) => (prev === 'admin' ? 'desktop' : 'admin'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLocalBooth])

  // On the public cloud server, regular visitors only see the Photo Delivery Hub
  if (!isLocalBooth) {
    return (
      <ErrorBoundary>
        <PublicPortal />
      </ErrorBoundary>
    )
  }

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
