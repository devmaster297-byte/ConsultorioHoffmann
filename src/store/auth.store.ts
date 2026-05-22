// src/store/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Usuario } from '@/lib/supabase/types'

interface AuthState {
  usuario: Usuario | null
  clinicaId: string | null
  email: string | null
  setUsuario: (usuario: Usuario | null, email?: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      clinicaId: null,
      email: null,
      setUsuario: (usuario, email) =>
        set({
          usuario,
          clinicaId: usuario?.clinica_id ?? null,
          email: email ?? null,
        }),
    }),
    {
      name: 'hoffmann-auth',
      partialize: (state) => ({
        usuario: state.usuario,
        clinicaId: state.clinicaId,
        email: state.email,
      }),
    }
  )
)
