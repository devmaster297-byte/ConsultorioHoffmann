// src/store/comissao.store.ts
// Armazena a % de comissão da secretária sobre os atendimentos do Dr. Eduardo
// Persiste em localStorage — sem necessidade de alterar o banco
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ComissaoState {
  percentualComissao: number           // ex: 10 = 10%
  nomeDentistaComissao: string         // nome parcial para identificar o dentista
  setPercentualComissao: (p: number) => void
  setNomeDentistaComissao: (nome: string) => void
}

export const useComissaoStore = create<ComissaoState>()(
  persist(
    (set) => ({
      percentualComissao: 10,
      nomeDentistaComissao: 'Eduardo',  // padrão: identifica Dr. Eduardo pelo nome
      setPercentualComissao: (p) => set({ percentualComissao: p }),
      setNomeDentistaComissao: (nome) => set({ nomeDentistaComissao: nome }),
    }),
    { name: 'hoffmann-comissao' }
  )
)
