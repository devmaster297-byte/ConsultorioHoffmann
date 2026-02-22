// src/store/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Usuario } from '@/lib/supabase/types'

interface AuthState {
  usuario: Usuario | null
  clinicaId: string | null
  setUsuario: (usuario: Usuario | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      clinicaId: null,
      setUsuario: (usuario) =>
        set({ usuario, clinicaId: usuario?.clinica_id ?? null }),
    }),
    {
      name: 'dentesoft-auth', // chave no localStorage
      // Só persiste os dados, não a função
      partialize: (state) => ({
        usuario: state.usuario,
        clinicaId: state.clinicaId,
      }),
    }
  )
)