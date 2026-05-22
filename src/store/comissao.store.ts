// src/store/comissao.store.ts
// Modelo financeiro:
// - Dr. Eduardo recebe X
// - Rosieli recebe percentualRosieli% do bruto do Eduardo (uso do espaço)
// - Patricia recebe percentualPatricia% do bruto do Eduardo (comissão)
// - Eduardo fica com o restante (100 - rosiele% - patricia%)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ComissaoState {
  percentualRosieli:  number  // % que Rosiele recebe do bruto do Eduardo (ex: 25)
  percentualPatricia: number  // % que Patricia recebe do bruto do Eduardo (ex: 5)
  setPercentualRosieli:  (p: number) => void
  setPercentualPatricia: (p: number) => void
}

export const useComissaoStore = create<ComissaoState>()(
  persist(
    (set) => ({
      percentualRosieli:  25,
      percentualPatricia: 5,
      setPercentualRosieli:  (p) => set({ percentualRosieli: p }),
      setPercentualPatricia: (p) => set({ percentualPatricia: p }),
    }),
    { name: 'hoffmann-comissao' }
  )
)
