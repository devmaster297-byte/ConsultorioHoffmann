// src/lib/hooks/useVencidosCount.ts
// Conta pacientes com parcelas vencidas para exibir badge na navbar
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-browser'

export function useVencidosCount(clinicaId: string | null) {
  const [count, setCount] = useState(0)

  const calcular = useCallback(async () => {
    if (!clinicaId) return

    const agora = new Date()
    const hoje = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
      .toISOString().split('T')[0]

    // 1. Marcar como vencidas as parcelas cujo prazo já passou
    //    (filtro direto por clinica_id — sem .in() de lançamentos)
    await supabase
      .from('financeiro_parcelas')
      .update({ status: 'vencido' })
      .eq('clinica_id', clinicaId)
      .in('status', ['pendente', 'pago_parcial'])
      .lt('data_vencimento', hoje)

    // 2. Buscar parcelas vencidas direto por clinica_id
    //    CORREÇÃO: antes buscávamos todos os lançamentos (764+) e passávamos os
    //    IDs num .in() — URL de 28 KB que o PostgREST descarta silenciosamente.
    //    Agora: parcelas vencidas primeiro, lançamentos só dos IDs necessários.
    const { data: vencidosRaw } = await supabase
      .from('financeiro_parcelas')
      .select('lancamento_id')
      .eq('clinica_id', clinicaId)
      .eq('status', 'vencido')

    const lancIdsVencidos = [
      ...new Set(
        (vencidosRaw ?? []).map((p: { lancamento_id: string }) => p.lancamento_id)
      ),
    ]

    if (!lancIdsVencidos.length) { setCount(0); return }

    // 3. Buscar os lançamentos apenas desses IDs para obter o paciente_id
    const { data: lancsRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('paciente_id')
      .in('id', lancIdsVencidos)
      .not('paciente_id', 'is', null)

    const pacientesComVencido = new Set(
      (lancsRaw ?? []).map((l: { paciente_id: string }) => l.paciente_id).filter(Boolean)
    )

    setCount(pacientesComVencido.size)
  }, [clinicaId])

  useEffect(() => {
    calcular()
    // Atualiza a cada 5 minutos
    const interval = setInterval(calcular, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [calcular])

  return count
}