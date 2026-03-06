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

// ✅ FIX ITEM 7: helper para derivar status a partir de um array de statuses de parcelas
function calcularStatus(statuses: string[]): StatusPagamento {
  if (statuses.length === 0) return 'aberto'
  if (statuses.every((s) => s === 'pago')) return 'pago'
  if (statuses.some((s) => s === 'pago' || s === 'pago_parcial')) return 'parcial'
  return 'aberto'
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

    const { data: atend, error } = await supabase
      .from('atendimentos')
      .select(`
        id,
        paciente_id,
        dentista_id,
        data_atendimento,
        procedimento_id,
        descricao,
        valor_total,
        procedimento:procedimentos(nome)
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

    const atendIds = atend.map((a: typeof atend[number]) => a.id)

    // Buscar nomes dos dentistas separadamente
    const dentistaIds = [
      ...new Set(atend.map((a: typeof atend[number]) => a.dentista_id).filter(Boolean)),
    ] as string[]
    const dentistaMap: Record<string, string> = {}
    if (dentistaIds.length > 0) {
      const { data: dentistas } = await supabase
        .from('usuarios')
        .select('id, nome')
        .in('id', dentistaIds)
      dentistas?.forEach((d: { id: string; nome: string }) => {
        dentistaMap[d.id] = d.nome
      })
    }

    // ── Status de pagamento ───────────────────────────────────────────────────
    //
    // ✅ FIX ITEM 7: lancamentos criados via orçamento usam paciente_id sem
    // preencher atendimento_id, fazendo todos os atendimentos aparecerem como
    // "Em aberto". A nova estratégia:
    //
    //  1. Busca TODOS os lancamentos de receita do paciente (por paciente_id)
    //  2. Para atendimentos com link direto (atendimento_id) → status específico
    //  3. Para os demais → usa o status agregado do paciente como estimativa

    const { data: lancsRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, atendimento_id')
      .eq('clinica_id', clinicaId)
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'receita')

    const lancamentos = (lancsRaw ?? []) as Array<{ id: string; atendimento_id: string | null }>
    const lancIds = lancamentos.map((l) => l.id)

    const lancAtendMap: Record<string, string | null> = Object.fromEntries(
      lancamentos.map((l) => [l.id, l.atendimento_id])
    )

    const atendIdsComLancamento = new Set(
      lancamentos.map((l) => l.atendimento_id).filter((id): id is string => !!id)
    )

    // Buscar parcelas de todos os lancamentos do paciente
    // ✅ FIX ITEM 5 também aplicado: excluir parcelas canceladas
    let parcelasData: Array<{ lancamento_id: string; status: string }> = []
    if (lancIds.length > 0) {
      const { data: parcsRaw } = await supabase
        .from('financeiro_parcelas')
        .select('lancamento_id, status')
        .in('lancamento_id', lancIds)
        .neq('status', 'cancelado')
      parcelasData = (parcsRaw ?? []) as typeof parcelasData
    }

    // Agrupar por atendimento (link direto) e acumular status geral do paciente
    const statusPorAtend: Record<string, string[]> = {}
    const statusGeralPaciente: string[] = []

    for (const p of parcelasData) {
      statusGeralPaciente.push(p.status)
      const atendId = lancAtendMap[p.lancamento_id]
      if (atendId) {
        if (!statusPorAtend[atendId]) statusPorAtend[atendId] = []
        statusPorAtend[atendId].push(p.status)
      }
    }

    const statusGeralCalc = calcularStatus(statusGeralPaciente)

    // Radiografias
    const { data: rxCounts } = await supabase
      .from('radiografias')
      .select('atendimento_id')
      .in('atendimento_id', atendIds)

    const rxPorAtend: Record<string, number> = {}
    rxCounts?.forEach((rx: { atendimento_id: string }) => {
      if (rx.atendimento_id) {
        rxPorAtend[rx.atendimento_id] = (rxPorAtend[rx.atendimento_id] ?? 0) + 1
      }
    })

    // Montar resultado
    const resultado: AtendimentoDetalhado[] = atend.map((a: typeof atend[number]) => {
      let status_pagamento: StatusPagamento

      if (atendIdsComLancamento.has(a.id)) {
        // Há lancamento diretamente vinculado a este atendimento
        status_pagamento = calcularStatus(statusPorAtend[a.id] ?? [])
      } else if (lancamentos.length > 0) {
        // Sem link direto — usa status agregado do paciente como melhor estimativa
        status_pagamento = statusGeralCalc
      } else {
        status_pagamento = 'aberto'
      }

      return {
        id: a.id,
        paciente_id: a.paciente_id,
        data_atendimento: a.data_atendimento,
        procedimento_id: a.procedimento_id,
        procedimento_nome:
          (a.procedimento as unknown as { nome: string } | null)?.nome ?? null,
        descricao: a.descricao,
        valor_total: a.valor_total,
        dentista_nome: a.dentista_id ? (dentistaMap[a.dentista_id] ?? null) : null,
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