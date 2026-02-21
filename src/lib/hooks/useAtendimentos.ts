// src/lib/hooks/useAtendimentos.ts
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type StatusPagamento = 'pago' | 'parcial' | 'aberto'

export interface AtendimentoDetalhado {
  id: string
  paciente_id: string
  data_atendimento: string
  procedimento_id: string | null
  procedimento_nome: string | null
  descricao: string | null
  valor_total: number | null
  dentista_nome: string | null
  status_pagamento: StatusPagamento
  total_radiografias: number
}

export function useAtendimentos(pacienteId: string, clinicaId: string) {
  const [atendimentos, setAtendimentos] = useState<AtendimentoDetalhado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!pacienteId || !clinicaId) return
    setCarregando(true)
    setErro(null)

    const supabase = createClient()

    // Buscar atendimentos com joins
    const { data: atend, error } = await supabase
      .from('atendimentos')
      .select(`
        id,
        paciente_id,
        data_atendimento,
        procedimento_id,
        descricao,
        valor_total,
        procedimento:procedimentos(nome),
        dentista:usuarios(nome)
      `)
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicaId)
      .order('data_atendimento', { ascending: false })

    if (error) {
      setErro('Erro ao carregar histórico')
      setCarregando(false)
      return
    }

    if (!atend || atend.length === 0) {
      setAtendimentos([])
      setCarregando(false)
      return
    }

    const atendIds = atend.map((a) => a.id)

    // Buscar lançamentos financeiros vinculados a esses atendimentos
    const { data: lancamentos } = await supabase
      .from('financeiro_lancamentos')
      .select('id, atendimento_id')
      .in('atendimento_id', atendIds)
      .eq('clinica_id', clinicaId)

    const lancamentoIds = lancamentos?.map((l) => l.id) ?? []
    const lancAtendMap = Object.fromEntries(
      (lancamentos ?? []).map((l) => [l.id, l.atendimento_id])
    )

    // Buscar parcelas para calcular status de pagamento
    const { data: parcelas } = lancamentoIds.length > 0
      ? await supabase
          .from('financeiro_parcelas')
          .select('lancamento_id, status')
          .in('lancamento_id', lancamentoIds)
      : { data: [] }

    // Agrupar parcelas por atendimento
    const parcelasAtend: Record<string, string[]> = {}
    parcelas?.forEach((p) => {
      const atendId = lancAtendMap[p.lancamento_id]
      if (atendId) {
        if (!parcelasAtend[atendId]) parcelasAtend[atendId] = []
        parcelasAtend[atendId].push(p.status)
      }
    })

    // Buscar quantidade de radiografias por atendimento
    const { data: rxCounts } = await supabase
      .from('radiografias')
      .select('atendimento_id')
      .in('atendimento_id', atendIds)

    const rxPorAtend: Record<string, number> = {}
    rxCounts?.forEach((rx) => {
      if (rx.atendimento_id) {
        rxPorAtend[rx.atendimento_id] = (rxPorAtend[rx.atendimento_id] ?? 0) + 1
      }
    })

    // Montar resultado final
    const resultado: AtendimentoDetalhado[] = atend.map((a) => {
      const statusParcelas = parcelasAtend[a.id] ?? []

      let status_pagamento: StatusPagamento = 'aberto'
      if (statusParcelas.length === 0) {
        status_pagamento = 'aberto'
      } else if (statusParcelas.every((s) => s === 'pago')) {
        status_pagamento = 'pago'
      } else if (statusParcelas.some((s) => s === 'pago' || s === 'pago_parcial')) {
        status_pagamento = 'parcial'
      } else {
        status_pagamento = 'aberto'
      }

      return {
        id: a.id,
        paciente_id: a.paciente_id,
        data_atendimento: a.data_atendimento,
        procedimento_id: a.procedimento_id,
        procedimento_nome: (a.procedimento as unknown as { nome: string } | null)?.nome ?? null,
        descricao: a.descricao,
        valor_total: a.valor_total,
        dentista_nome: (a.dentista as unknown as { nome: string } | null)?.nome ?? null,
        status_pagamento,
        total_radiografias: rxPorAtend[a.id] ?? 0,
      }
    })

    setAtendimentos(resultado)
    setCarregando(false)
  }, [pacienteId, clinicaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { atendimentos, carregando, erro, recarregar: carregar }
}