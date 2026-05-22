// src/lib/hooks/useResumoFinanceiroPaciente.ts
// Calcula em uma só rodada de queries: total contratado, pago e saldo devedor
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-browser'

export interface ResumoFinanceiro {
  totalContratado: number  // soma dos valor_total dos lançamentos
  totalPago:       number  // soma dos valor_pago das parcelas pagas
  saldoDevedor:    number  // totalContratado - totalPago (nunca negativo)
  numParcelas:     number  // total de parcelas
  numPagas:        number  // parcelas com status pago
  numVencidas:     number  // parcelas vencidas
  numPendentes:    number  // parcelas pendentes
  carregando:      boolean
}

const INICIAL: ResumoFinanceiro = {
  totalContratado: 0,
  totalPago:       0,
  saldoDevedor:    0,
  numParcelas:     0,
  numPagas:        0,
  numVencidas:     0,
  numPendentes:    0,
  carregando:      true,
}

export function useResumoFinanceiroPaciente(
  pacienteId: string,
  clinicaId: string
): ResumoFinanceiro {
  const [resumo, setResumo] = useState<ResumoFinanceiro>(INICIAL)

  const calcular = useCallback(async () => {
    if (!pacienteId || !clinicaId) {
      setResumo({ ...INICIAL, carregando: false })
      return
    }

    // Buscar lançamentos de receita do paciente
    const { data: lancsRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, valor_total')
      .eq('clinica_id', clinicaId)
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'receita')

    const lancs = (lancsRaw ?? []) as { id: string; valor_total: number }[]

    if (!lancs.length) {
      setResumo({ ...INICIAL, carregando: false })
      return
    }

    const lancIds = lancs.map(l => l.id)
    const totalContratado = lancs.reduce((s, l) => s + l.valor_total, 0)

    // Buscar todas as parcelas desses lançamentos
    const { data: parcsRaw } = await supabase
      .from('financeiro_parcelas')
      .select('status, valor_pago, valor')
      .in('lancamento_id', lancIds)

    const parcs = (parcsRaw ?? []) as {
      status: string
      valor_pago: number | null
      valor: number
    }[]

    let totalPago    = 0
    let numPagas     = 0
    let numVencidas  = 0
    let numPendentes = 0

    for (const p of parcs) {
      if (p.status === 'pago' || p.status === 'pago_parcial') {
        totalPago += p.valor_pago ?? 0
        numPagas++
      } else if (p.status === 'vencido') {
        numVencidas++
      } else if (p.status === 'pendente') {
        numPendentes++
      }
    }

    setResumo({
      totalContratado,
      totalPago,
      saldoDevedor: Math.max(0, totalContratado - totalPago),
      numParcelas:  parcs.length,
      numPagas,
      numVencidas,
      numPendentes,
      carregando:   false,
    })
  }, [pacienteId, clinicaId])

  useEffect(() => { calcular() }, [calcular])

  return resumo
}
