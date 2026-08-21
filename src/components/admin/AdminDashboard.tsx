import { useState, useEffect } from 'react'
import Window from '../Window'
import FloatingDeco from '../FloatingDeco'
import ArchiveTab from './ArchiveTab'
import PropsTab from './PropsTab'
import StickersTab from './StickersTab'
import BackgroundsTab from './BackgroundsTab'
import SettingsTab from './SettingsTab'
import {
  getArchive,
  getCustomProps,
  getCustomStickers,
  getCustomBackgrounds,
} from '../../lib/db'

type Tab = 'archive' | 'props' | 'stickers' | 'backgrounds' | 'settings'

type Props = {
  onExit: () => void
  onStartBooth: () => void
}

export default function AdminDashboard({ onExit, onStartBooth }: Props) {
  const [tab, setTab] = useState<Tab>('archive')
  const [stats, setStats] = useState({
    photos: 0,
    favorites: 0,
    props: 0,
    stickers: 0,
    backgrounds: 0,
  })

  const loadStats = async () => {
    try {
      const [archive, props, stickers, backgrounds] = await Promise.all([
        getArchive(),
        getCustomProps(),
        getCustomStickers(),
        getCustomBackgrounds(),
      ])
      setStats({
        photos: archive.length,
        favorites: archive.filter((a) => a.favorite).length,
        props: props.length,
        stickers: stickers.length,
        backgrounds: backgrounds.length,
      })
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div className="relative min-h-screen p-3 sm:p-6 flex flex-col items-center justify-start overflow-x-hidden">
      {/* Floating pixel clouds background */}
      <FloatingDeco />

      <div className="relative z-10 w-full max-w-6xl mx-auto my-auto space-y-4">
        {/* Top Header Card */}
        <div className="bg-[#efefff] border-3 border-[#8198ed] rounded-xl shadow-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#8198ed] text-white grid place-items-center text-xl font-bold shadow-md">
              ⚙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-pixel text-base sm:text-lg text-[#5b7fcb]">
                  OmoideCam Admin Studio
                </h1>
                <span className="bg-[#8198ed] text-white text-[8px] font-pixel px-1.5 py-0.5 rounded shadow-sm">
                  OPERATOR
                </span>
              </div>
              <p className="font-pixel text-[9px] text-[#8792c4] mt-0.5">
                Photo Archive • Print Studio • AR Props • Stickers • Event Frames
              </p>
            </div>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white bevel-in px-3 py-1.5 rounded-md text-center">
              <span className="font-pixel text-[8px] text-slate-400 block">TOTAL PHOTOS</span>
              <span className="font-pixel text-xs text-[#5b7fcb] font-bold">📸 {stats.photos}</span>
            </div>
            <div className="bg-white bevel-in px-3 py-1.5 rounded-md text-center">
              <span className="font-pixel text-[8px] text-slate-400 block">FAVORITES</span>
              <span className="font-pixel text-xs text-[#d97706] font-bold">⭐ {stats.favorites}</span>
            </div>
            <div className="bg-white bevel-in px-3 py-1.5 rounded-md text-center">
              <span className="font-pixel text-[8px] text-slate-400 block">CUSTOM ASSETS</span>
              <span className="font-pixel text-xs text-[#7c3aed] font-bold">
                🎨 {stats.props + stats.stickers + stats.backgrounds}
              </span>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onStartBooth}
              className="btn95 is-primary !px-4 !py-2 text-xs font-bold flex items-center gap-1.5"
            >
              <span>📷</span>
              <span>Launch Booth</span>
            </button>
            <button onClick={onExit} className="btn95 !px-3 !py-2 text-xs font-bold">
              Exit
            </button>
          </div>
        </div>

        {/* Main Content Window */}
        <Window
          title={`Admin Control Center — ${
            tab === 'archive'
              ? 'Photo Archive & Print Studio'
              : tab === 'props'
              ? 'AR Wearables & Face Tracking'
              : tab === 'stickers'
              ? 'Stickers & Doodles'
              : tab === 'backgrounds'
              ? 'Event Frames & Backgrounds'
              : 'Branding & Preferences'
          }`}
          icon={<span className="text-xs">🔒</span>}
          className="w-full shadow-2xl rounded-xl"
          collapsible={false}
          onClose={onExit}
        >
          {/* Navigation Bar Tabs */}
          <div className="flex flex-wrap gap-1.5 pb-4 mb-4 border-b-2 border-[#8198ed]">
            <button
              onClick={() => setTab('archive')}
              className={`btn95 !px-3 sm:!px-4 !py-2 text-xs font-bold flex items-center gap-1.5 ${
                tab === 'archive' ? 'is-primary' : ''
              }`}
            >
              <span>🖼️</span>
              <span>Archive ({stats.photos})</span>
            </button>

            <button
              onClick={() => setTab('props')}
              className={`btn95 !px-3 sm:!px-4 !py-2 text-xs font-bold flex items-center gap-1.5 ${
                tab === 'props' ? 'is-primary' : ''
              }`}
            >
              <span>🎭</span>
              <span>AR Wearables {stats.props > 0 ? `(${stats.props})` : ''}</span>
            </button>

            <button
              onClick={() => setTab('stickers')}
              className={`btn95 !px-3 sm:!px-4 !py-2 text-xs font-bold flex items-center gap-1.5 ${
                tab === 'stickers' ? 'is-primary' : ''
              }`}
            >
              <span>🎨</span>
              <span>Stickers {stats.stickers > 0 ? `(${stats.stickers})` : ''}</span>
            </button>

            <button
              onClick={() => setTab('backgrounds')}
              className={`btn95 !px-3 sm:!px-4 !py-2 text-xs font-bold flex items-center gap-1.5 ${
                tab === 'backgrounds' ? 'is-primary' : ''
              }`}
            >
              <span>📐</span>
              <span>Event Frames {stats.backgrounds > 0 ? `(${stats.backgrounds})` : ''}</span>
            </button>

            <button
              onClick={() => setTab('settings')}
              className={`btn95 !px-3 sm:!px-4 !py-2 text-xs font-bold flex items-center gap-1.5 ${
                tab === 'settings' ? 'is-primary' : ''
              }`}
            >
              <span>⚙️</span>
              <span>Settings & Backup</span>
            </button>
          </div>

          {/* Tab Views */}
          <div className="min-h-[460px]">
            {tab === 'archive' && <ArchiveTab onStatsChange={loadStats} />}
            {tab === 'props' && <PropsTab onPropsChange={loadStats} />}
            {tab === 'stickers' && <StickersTab onStickersChange={loadStats} />}
            {tab === 'backgrounds' && <BackgroundsTab onBackgroundsChange={loadStats} />}
            {tab === 'settings' && <SettingsTab onSettingsChange={loadStats} />}
          </div>
        </Window>
      </div>
    </div>
  )
}
