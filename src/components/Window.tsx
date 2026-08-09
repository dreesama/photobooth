import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

type WindowProps = {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  draggable?: boolean
  initial?: { x: number; y: number }
  width?: number | string
  onClose?: () => void
  collapsible?: boolean
  z?: number
  onFocus?: () => void
  scroll?: boolean
}

// Classic desktop window: pink title bar with - [ ] x controls, beveled body.
export default function Window({
  title,
  icon,
  children,
  className = '',
  bodyClassName = '',
  draggable = false,
  initial = { x: 0, y: 0 },
  width,
  onClose,
  collapsible = true,
  z = 1,
  onFocus,
  scroll = false,
}: WindowProps) {
  const [pos, setPos] = useState(initial)
  const [collapsed, setCollapsed] = useState(false)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggable) return
    onFocus?.()
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const style = draggable
    ? { transform: `translate(${pos.x}px, ${pos.y}px)`, width, zIndex: z }
    : { width }

  return (
    <div
      className={`bg-[var(--window)] bevel select-none ${draggable ? 'absolute' : ''} ${className}`}
      style={style as any}
      onPointerDown={onFocus}
    >
      <div
        className={`flex items-center gap-2 px-1.5 py-1 text-[var(--window-title-text)] ${
          draggable ? 'cursor-move touch-none' : ''
        }`}
        style={{
          background:
            'linear-gradient(90deg, var(--window-title), var(--window-title-2))',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {icon && <span className="shrink-0 leading-none">{icon}</span>}
        <span className="font-pixel text-[9px] tracking-tight truncate flex-1">
          {title}
        </span>
        <div className="flex items-center gap-0.5">
          {collapsible && (
            <button
              className="title-btn"
              aria-label="Minimize"
              onClick={() => setCollapsed((c) => !c)}
            >
              _
            </button>
          )}
          <span className="title-btn" aria-hidden>
            ▢
          </span>
          <button
            className="title-btn"
            aria-label="Close"
            onClick={() => onClose?.()}
          >
            ✕
          </button>
        </div>
      </div>
      {!collapsed && (
        <div
          className={`p-3 ${scroll ? 'overflow-auto' : ''} ${bodyClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}
