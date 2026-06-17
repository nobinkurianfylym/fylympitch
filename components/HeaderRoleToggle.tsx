'use client'

import { useRole } from './RoleProvider'

export default function HeaderRoleToggle() {
  const { role, setRole } = useRole()

  return (
    <div className="hidden md:flex items-center gap-1">
      <button
        onClick={() => setRole('filmmaker')}
        className="relative px-2.5 py-1 text-[11px] tracking-[0.18em] uppercase transition-colors duration-200"
        style={{ color: role === 'filmmaker' ? 'var(--color-ink)' : 'var(--color-ash)' }}
      >
        Filmmaker
        <span
          className="absolute bottom-0 left-2.5 right-2.5 h-[1px] bg-gold transition-opacity duration-300"
          style={{ opacity: role === 'filmmaker' ? 1 : 0 }}
        />
      </button>

      <span
        className="text-[11px] select-none"
        style={{ color: 'var(--color-ash)' }}
      >
        ·
      </span>

      <button
        onClick={() => setRole('producer')}
        className="relative px-2.5 py-1 text-[11px] tracking-[0.18em] uppercase transition-colors duration-200"
        style={{ color: role === 'producer' ? 'var(--color-ink)' : 'var(--color-ash)' }}
      >
        Producer
        <span
          className="absolute bottom-0 left-2.5 right-2.5 h-[1px] bg-gold transition-opacity duration-300"
          style={{ opacity: role === 'producer' ? 1 : 0 }}
        />
      </button>
    </div>
  )
}
