import { useState, useEffect } from 'react'
import Desktop from './components/Desktop'
import Booth from './components/booth/Booth'
import AdminDashboard from './components/admin/AdminDashboard'
import AdminPasscodeModal, { isAdminAuthenticated } from './components/admin/AdminPasscodeModal'
import ErrorBoundary from './components/ErrorBoundary'
import PublicPortal from './components/PublicPortal'

export default function App() {
  const [view, setView] = useState<'desktop' | 'booth' | 'admin' | 'public'>('desktop')
  const [showPasscodeModal, setShowPasscodeModal] = useState(false)
  const [pendingAdminView, setPendingAdminView] = useState<'admin' | 'desktop'>('admin')

  // Check if we are in local booth kiosk mode vs public domain
  const isLocalHost = (() => {
    if (typeof window === 'undefined') return true
    const host = window.location.hostname
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      (host.startsWith('172.') && parseInt(host.split('.')[1] || '0') >= 16)
    )
  })()

  // Initialize view based on URL parameters / authentication
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const hash = window.location.hash.toLowerCase()
    const path = window.location.pathname.toLowerCase()

    const wantsAdmin =
      params.has('admin') ||
      params.get('portal') === 'itguild' ||
      params.get('operator') === '1' ||
      hash === '#admin' ||
      hash === '#itguild-admin' ||
      path === '/admin' ||
      path === '/itguild-admin'

    if (isAdminAuthenticated()) {
      setView(wantsAdmin ? 'admin' : 'desktop')
    } else {
      // Require master passcode on public deployment
      setPendingAdminView(wantsAdmin ? 'admin' : 'desktop')
      setShowPasscodeModal(true)
    }
  }, [])

  // Global keyboard shortcut to open Admin Studio (Ctrl + Shift + A or Alt + A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') ||
        (e.altKey && e.key.toLowerCase() === 'a')
      ) {
        e.preventDefault()
        handleOpenAdmin()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleOpenAdmin = () => {
    if (isAdminAuthenticated()) {
      setView('admin')
    } else {
      setPendingAdminView('admin')
      setShowPasscodeModal(true)
    }
  }

  const handlePasscodeSuccess = () => {
    setShowPasscodeModal(false)
    setView(pendingAdminView)
  }

  return (
    <ErrorBoundary>
      {/* Passcode Gate Modal */}
      {showPasscodeModal && (
        <AdminPasscodeModal
          onSuccess={handlePasscodeSuccess}
          onCancel={() => setShowPasscodeModal(false)}
        />
      )}

      {/* Main Views */}
      {view === 'admin' && (
        <AdminDashboard
          onExit={() => setView('desktop')}
          onStartBooth={() => setView('booth')}
        />
      )}
      {view === 'booth' && (
        <Booth
          onExit={() => setView('desktop')}
          onOpenAdmin={handleOpenAdmin}
        />
      )}
      {view === 'desktop' && (
        <Desktop
          onStart={() => setView('booth')}
          onOpenAdmin={handleOpenAdmin}
        />
      )}
    </ErrorBoundary>
  )
}

