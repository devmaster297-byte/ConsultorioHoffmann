// src/store/comissao.store.ts
// Modelo financeiro da clínica:
// - Dr. Eduardo paga percentualRepasse% à Dra. Rosiele pelo uso do espaço
// - Patricia recebe percentualSecretaria% sobre o repasse do Dr. Eduardo
// Persiste em localStorage — sem coluna extra no banco.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ComissaoState {
  percentualRepasse:    number  // % que Eduardo paga à Rosiele (ex: 30)
  percentualSecretaria: number  // % que Patricia recebe sobre o repasse (ex: 5)
  setPercentualRepasse:    (p: number) => void
  setPercentualSecretaria: (p: number) => void
}

export const useComissaoStore = create<ComissaoState>()(
  persist(
    (set) => ({
      percentualRepasse:    30,
      percentualSecretaria: 5,
      setPercentualRepasse:    (p) => set({ percentualRepasse: p }),
      setPercentualSecretaria: (p) => set({ percentualSecretaria: p }),
    }),
    { name: 'hoffmann-comissao' }
  )
)
