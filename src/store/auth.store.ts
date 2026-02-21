// src/store/auth.store.ts
import { create } from 'zustand'
import { Usuario } from '@/lib/supabase/types'

interface AuthState {
  usuario: Usuario | null
  setUsuario: (usuario: Usuario | null) => void
  clinicaId: string | null
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  clinicaId: null,
  setUsuario: (usuario) => set({ usuario, clinicaId: usuario?.clinica_id ?? null }),
}))
