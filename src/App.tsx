import { useState, useEffect } from 'react'
import Desktop from './components/Desktop'
import Booth from './components/booth/Booth'
import AdminDashboard from './components/admin/AdminDashboard'
import AdminPasscodeModal, { isAdminAuthenticated } from './components/admin/AdminPasscodeModal'
import ErrorBoundary from './components/ErrorBoundary'
import PublicPortal from './components/PublicPortal'
import MobilePhotoViewer from './components/MobilePhotoViewer'

export default function App() {
  const [photoId, setPhotoId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const p = params.get('photo') || params.get('p')
      if (p) return p
      const path = window.location.pathname
      if (path.startsWith('/photo/')) {
        return path.replace('/photo/', '').split('/')[0]
      }
      const hash = window.location.hash
      if (hash.startsWith('#photo-') || hash.startsWith('#photo/')) {
        return hash.replace(/^#photo[-/]/, '')
      }
    }
    return null
  })

  const [view, setViewState] = useState<'desktop' | 'booth' | 'admin' | 'public'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('itguild_current_view') as any
      if (saved && ['desktop', 'booth', 'admin', 'public'].includes(saved)) {
        return saved
      }
    }
    return 'desktop'
  })

  const setView = (newView: 'desktop' | 'booth' | 'admin' | 'public') => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('itguild_current_view', newView)
    }
    setViewState(newView)
  }

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

    const savedView = sessionStorage.getItem('itguild_current_view') as any

    if (isAdminAuthenticated()) {
      if (wantsAdmin) {
        setView('admin')
      } else if (savedView) {
        setView(savedView)
      }
    } else if (wantsAdmin) {
      setPendingAdminView('admin')
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

  // If user scanned QR code with photoId, render MobilePhotoViewer directly
  if (photoId) {
    return (
      <ErrorBoundary>
        <MobilePhotoViewer
          photoId={photoId}
          onBackToHome={() => {
            setPhotoId(null)
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', window.location.pathname)
            }
          }}
        />
      </ErrorBoundary>
    )
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

