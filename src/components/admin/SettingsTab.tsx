import { useState, useEffect } from 'react'
import { Save, Download, Upload, Check } from 'lucide-react'
import {
  getSettings,
  saveSettings,
  getArchive,
  getCustomProps,
  getCustomStickers,
  getCustomBackgrounds,
  saveToArchive,
  saveCustomProp,
  saveCustomSticker,
  saveCustomBackground,
  clearArchive,
  type EventSettings,
  DEFAULT_SETTINGS,
} from '../../lib/db'
import { getStoredPasscode, setStoredPasscode } from './AdminPasscodeModal'

export default function SettingsTab({ onSettingsChange }: { onSettingsChange?: () => void }) {
  const [settings, setSettings] = useState<EventSettings>(DEFAULT_SETTINGS)
  const [passcode, setPasscode] = useState(getStoredPasscode())
  const [savedMessage, setSavedMessage] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveSettings(settings)
    onSettingsChange?.()
    setSavedMessage('Settings successfully saved!')
    setTimeout(() => setSavedMessage(''), 3000)
  }

  const handleExportBackup = async () => {
    setExporting(true)
    try {
      const [archive, props, stickers, backgrounds, curSettings] = await Promise.all([
        getArchive(),
        getCustomProps(),
        getCustomStickers(),
        getCustomBackgrounds(),
        getSettings(),
      ])

      const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        archive,
        props,
        stickers,
        backgrounds,
        settings: curSettings,
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `itguild-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('Importing this backup will merge items into your archive and assets. Proceed?')) return

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string)
        if (data.archive && Array.isArray(data.archive)) {
          for (const item of data.archive) {
            await saveToArchive(item)
          }
        }
        if (data.props && Array.isArray(data.props)) {
          for (const p of data.props) {
            await saveCustomProp(p)
          }
        }
        if (data.stickers && Array.isArray(data.stickers)) {
          for (const s of data.stickers) {
            await saveCustomSticker(s)
          }
        }
        if (data.backgrounds && Array.isArray(data.backgrounds)) {
          for (const b of data.backgrounds) {
            await saveCustomBackground(b)
          }
        }
        if (data.settings) {
          await saveSettings(data.settings)
          setSettings(data.settings)
        }
        alert('Backup successfully imported!')
        onSettingsChange?.()
      } catch (err) {
        alert('Failed to parse backup file. Please ensure it is a valid JSON backup.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Event Branding */}
        <div className="bg-white p-4 rounded-xl bevel-in space-y-4">
          <h2 className="font-pixel text-xs sm:text-sm text-[#5b7fcb] pb-2 border-b border-slate-100">
            Event Branding & Watermark
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">
                Event Name / Booth Title
              </label>
              <input
                type="text"
                value={settings.eventName}
                onChange={(e) => setSettings({ ...settings, eventName: e.target.value })}
                className="w-full bg-[#f8fafc] bevel-in px-3 py-2 text-xs font-mono outline-none rounded"
              />
              <p className="font-sans text-[10px] text-slate-400 mt-1">
                Displayed in admin logs and archive metadata.
              </p>
            </div>

            <div>
              <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">
                Custom Bottom Watermark Text
              </label>
              <input
                type="text"
                value={settings.customWatermark}
                onChange={(e) => setSettings({ ...settings, customWatermark: e.target.value })}
                placeholder="IT GUILD"
                className="w-full bg-[#f8fafc] bevel-in px-3 py-2 text-xs font-mono outline-none rounded"
              />
              <p className="font-sans text-[10px] text-slate-400 mt-1">
                Appears at the bottom chin of every photo strip (e.g. "IT GUILD", "Tech Summit 2026").
              </p>
            </div>
          </div>
        </div>

        {/* Photobooth Preferences */}
        <div className="bg-white p-4 rounded-xl bevel-in space-y-4">
          <h2 className="font-pixel text-xs sm:text-sm text-[#5b7fcb] pb-2 border-b border-slate-100">
            Photobooth & Printing Preferences
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">
                Default Countdown Timer
              </label>
              <select
                value={settings.defaultTimer}
                onChange={(e) => setSettings({ ...settings, defaultTimer: parseInt(e.target.value) })}
                className="w-full bg-[#f8fafc] bevel-in px-3 py-2 text-xs font-mono outline-none rounded"
              >
                <option value={3}>3 Seconds</option>
                <option value={5}>5 Seconds</option>
                <option value={10}>10 Seconds</option>
              </select>
            </div>

            <div>
              <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">
                Default Print Layout
              </label>
              <select
                value={settings.printLayout}
                onChange={(e) => setSettings({ ...settings, printLayout: e.target.value as any })}
                className="w-full bg-[#f8fafc] bevel-in px-3 py-2 text-xs font-mono outline-none rounded"
              >
                <option value="double_4x6">Dual 2x6 on 4x6 Sheet (Classic 2-strip cut)</option>
                <option value="single">Single Strip Centered</option>
                <option value="grid">Full Sheet Grid</option>
              </select>
            </div>

            <div>
              <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">
                Auto-Save to Archive
              </label>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="autoSave"
                  checked={settings.autoSaveToArchive}
                  onChange={(e) => setSettings({ ...settings, autoSaveToArchive: e.target.checked })}
                  className="w-4 h-4 accent-[#8198ed]"
                />
                <label htmlFor="autoSave" className="font-pixel text-[9px] text-slate-700 cursor-pointer">
                  Save all sessions to local database
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Passcode Security */}
        <div className="bg-white p-4 rounded-xl bevel-in space-y-4">
          <h2 className="font-pixel text-xs sm:text-sm text-[#5b7fcb] pb-2 border-b border-slate-100 flex items-center justify-between">
            <span>Admin Passcode Security</span>
            <span className="text-[9px] text-[#8198ed] font-mono font-normal">Railway Protection</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">
                Admin Master Passcode / PIN
              </label>
              <input
                type="text"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value)
                  setStoredPasscode(e.target.value)
                }}
                placeholder="2026"
                className="w-full bg-[#f8fafc] bevel-in px-3 py-2 text-xs font-mono outline-none rounded"
              />
              <p className="font-sans text-[10px] text-slate-400 mt-1">
                Protects the Admin Dashboard on Railway and public networks. Default is <code>2026</code>.
              </p>
            </div>

            <div className="bg-[#f0f4ff] p-3 rounded-lg border border-[#cdd6f0] text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-[#5b7fcb]">Secret Admin Direct Access Links:</p>
              <p className="font-mono text-[10px] text-slate-500 break-all">
                <code>?admin=itguild</code> or <code>#itguild-admin</code>
              </p>
              <p className="text-[10px] text-slate-400">
                Opening these secret URL parameters automatically prompts for your passcode.
              </p>
            </div>
          </div>
        </div>

        {/* Public Softcopy & QR Cloud Delivery */}
        <div className="bg-white p-4 rounded-xl bevel-in space-y-4">
          <h2 className="font-pixel text-xs sm:text-sm text-[#5b7fcb] pb-2 border-b border-slate-100 flex items-center justify-between">
            <span>Public Cloud QR Server URL</span>
            <span className="text-[9px] text-[#8198ed] font-mono font-normal">Railway Hosted</span>
          </h2>

          <div>
            <label className="block font-pixel text-[10px] text-[#5b7fcb] mb-1">
              Public QR Endpoint / Domain
            </label>
            <input
              type="text"
              value={settings.publicServerUrl || ''}
              onChange={(e) => setSettings({ ...settings, publicServerUrl: e.target.value })}
              placeholder="https://esportcup.up.railway.app"
              className="w-full bg-[#f8fafc] bevel-in px-3 py-2 text-xs font-mono outline-none rounded"
            />
            <p className="font-sans text-[10px] text-slate-400 mt-1">
              When taking photos on this local computer, QR codes point directly to this domain (e.g. <code>https://esportcup.up.railway.app/photo/xxx</code>) so guests only get the download page and cannot access your local photobooth machine or admin controls.
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between">
          <span className="font-pixel text-xs text-green-600 font-bold flex items-center gap-1">
            {savedMessage && <Check className="w-3.5 h-3.5 text-green-600" />}
            <span>{savedMessage}</span>
          </span>
          <button type="submit" className="btn95 is-primary !px-6 !py-2.5 text-xs font-bold flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      {/* Database Backup & Disaster Recovery */}
      <div className="bg-white p-4 rounded-xl bevel-in space-y-4">
        <h2 className="font-pixel text-xs sm:text-sm text-[#5b7fcb] pb-2 border-b border-slate-100">
          Database Backup & Migration
        </h2>

        <p className="font-sans text-xs text-slate-500 leading-relaxed">
          Export your entire photobooth database (all high-res photo strips, camera shots, custom props,
          stickers, and frame backgrounds) into a single JSON file for offline archival, backups, or moving to
          another machine.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={exporting}
            className="btn95 !px-4 !py-2 text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Exporting...' : 'Export Complete Backup (JSON)'}</span>
          </button>

          <label className="btn95 is-accent !px-4 !py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import Backup (JSON)</span>
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  )
}
