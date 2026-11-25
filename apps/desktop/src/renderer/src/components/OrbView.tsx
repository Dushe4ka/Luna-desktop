import { useEffect, useRef, useState } from 'react'
import type { LunaSnapshot } from '../../../shared/luna'

/** Порог в пикселях, после которого жест считается перетаскиванием, а не кликом. */
const DRAG_THRESHOLD = 4

const STATE_LABELS: Record<LunaSnapshot['state'], string> = {
  idle: 'Работает',
  listening: 'Слушаю',
  thinking: 'Думаю',
  acting: 'Действую',
  approval: 'Жду вашего «да»',
  error: 'Нет связи',
  paused: 'На паузе'
}

/** Значок Луны. Клик — ввод, правый клик — меню, перетаскивание — переместить. */
export default function OrbView() {
  const [snapshot, setSnapshot] = useState<LunaSnapshot | null>(null)
  const pressed = useRef(false)
  const travel = useRef(0)

  useEffect(() => {
    void window.luna.getSnapshot().then(setSnapshot)
    return window.luna.onSnapshot(setSnapshot)
  }, [])

  const state = snapshot?.state ?? 'idle'

  return (
    <div
      className="orb-stage"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        pressed.current = true
        travel.current = 0
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!pressed.current) return
        travel.current += Math.abs(e.movementX) + Math.abs(e.movementY)
        if (travel.current > DRAG_THRESHOLD) {
          window.luna.dragBy(e.movementX, e.movementY)
        }
      }}
      onPointerUp={(e) => {
        if (e.button !== 0 || !pressed.current) return
        pressed.current = false
        e.currentTarget.releasePointerCapture(e.pointerId)
        if (travel.current <= DRAG_THRESHOLD) window.luna.openPanel('input')
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        pressed.current = false
        window.luna.openPanel('menu')
      }}
    >
      <div
        className="orb"
        data-state={state}
        data-full={snapshot?.fullAccess ? 'true' : 'false'}
        role="button"
        tabIndex={0}
        aria-label={`Луна: ${STATE_LABELS[state]}${snapshot?.fullAccess ? ', полный доступ включён' : ''}. Клик — ввод, правый клик — меню`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') window.luna.openPanel('input')
        }}
      >
        <span className="halo" />
        <span className="ring r1" />
        <span className="ring r2" />
        <span className="dot" />
        <span className="core" />
        <span className="badge" />
      </div>
    </div>
  )
}
