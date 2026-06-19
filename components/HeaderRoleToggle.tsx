'use client'

import { useRole } from './RoleProvider'

export default function HeaderRoleToggle({
  isLoggedIn = false,
  isAdmin    = false,
}: {
  isLoggedIn?: boolean
  isAdmin?:    boolean
}) {
  const { role, setRole } = useRole()

  // Only show toggle for logged-out visitors and admins
  if (isLoggedIn && !isAdmin) return null

  return (
    <div
      className="hidden md:flex items-center p-[3px] rounded-full"
      style={{ border: '1px solid rgba(26,24,21,0.18)' }}
    >
      <button
        onClick={() => setRole('filmmaker')}
        className="rounded-full text-[10px] tracking-[0.12em] uppercase font-medium px-3.5 py-[5px] transition-all duration-200"
        style={{
          background: role === 'filmmaker' ? 'var(--color-ink)' : 'transparent',
          color:      role === 'filmmaker' ? 'var(--color-ivory)' : 'var(--color-ash)',
        }}
      >
        Filmmaker
      </button>
      <button
        onClick={() => setRole('producer')}
        className="rounded-full text-[10px] tracking-[0.12em] uppercase font-medium px-3.5 py-[5px] transition-all duration-200"
        style={{
          background: role === 'producer' ? 'var(--color-ink)' : 'transparent',
          color:      role === 'producer' ? 'var(--color-ivory)' : 'var(--color-ash)',
        }}
      >
        Producer
      </button>
    </div>
  )
}
