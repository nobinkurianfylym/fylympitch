'use client'

import { createContext, useContext, useState, useCallback } from 'react'

export type Role = 'filmmaker' | 'producer'

interface RoleContextValue {
  role: Role
  setRole: (r: Role) => void
}

const RoleContext = createContext<RoleContextValue>({
  role: 'filmmaker',
  setRole: () => {},
})

export function RoleProvider({
  children,
  initialRole,
}: {
  children: React.ReactNode
  initialRole: Role
}) {
  const [role, setRoleState] = useState<Role>(initialRole)

  const setRole = useCallback((r: Role) => {
    setRoleState(r)
    document.cookie = `fyp_role=${r}; path=/; max-age=31536000; SameSite=Lax`
  }, [])

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  return useContext(RoleContext)
}
