// src/store/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Usuario } from '@/lib/supabase/types'
import { resetClient } from '@/lib/supabase/client'

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
      setUsuario: (usuario, email) => {
        // Ao fazer logout (usuario = null), limpar o singleton do cliente Supabase
        // para evitar vazamento de dados entre sessões diferentes
        if (!usuario) {
          resetClient()
        }
        set({
          usuario,
          clinicaId: usuario?.clinica_id ?? null,
          email: email ?? null
        })
      },
    }),
    {
      name: 'hoffmann-auth',
      // Só persiste os dados, não as funções
      partialize: (state) => ({
        usuario: state.usuario,
        clinicaId: state.clinicaId,
        email: state.email
      }),
    }
  )
)