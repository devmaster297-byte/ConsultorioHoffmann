// src/store/comissao.store.ts
// Modelo financeiro:
// - Dr. Eduardo recebe X
// - Rosiele recebe percentualRosiele% do bruto do Eduardo (uso do espaço)
// - Patricia recebe percentualPatricia% do bruto do Eduardo (comissão)
// - Eduardo fica com o restante (100 - rosiele% - patricia%)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ComissaoState {
  percentualRosiele:  number  // % que Rosiele recebe do bruto do Eduardo (ex: 25)
  percentualPatricia: number  // % que Patricia recebe do bruto do Eduardo (ex: 5)
  setPercentualRosiele:  (p: number) => void
  setPercentualPatricia: (p: number) => void
}

export const useComissaoStore = create<ComissaoState>()(
  persist(
    (set) => ({
      percentualRosiele:  25,
      percentualPatricia: 5,
      setPercentualRosiele:  (p) => set({ percentualRosiele: p }),
      setPercentualPatricia: (p) => set({ percentualPatricia: p }),
    }),
    { name: 'hoffmann-comissao' }
  )
)
