// src/lib/hooks/useVencidosCount.ts
// Conta pacientes com parcelas vencidas para exibir badge na navbar
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-browser'

export function useVencidosCount(clinicaId: string | null) {
  const [count, setCount] = useState(0)

  const calcular = useCallback(async () => {
    if (!clinicaId) return

    // Atualizar status vencido (mesma lógica do useFinanceiro)
    const agora = new Date()
    const hoje = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
      .toISOString().split('T')[0]

    await supabase
      .from('financeiro_parcelas')
      .update({ status: 'vencido' })
      .eq('clinica_id', clinicaId)
      .in('status', ['pendente', 'pago_parcial'])
      .lt('data_vencimento', hoje)

    // Contar pacientes distintos com parcelas vencidas
    const { data: lancsRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, paciente_id')
      .eq('clinica_id', clinicaId)
      .not('paciente_id', 'is', null)

    const lancs = (lancsRaw ?? []) as { id: string; paciente_id: string }[]
    if (!lancs.length) { setCount(0); return }

    const lancIds = lancs.map(l => l.id)
    const lancPacMap: Record<string, string> = {}
    lancs.forEach(l => { lancPacMap[l.id] = l.paciente_id })

    const { data: vencidosRaw } = await supabase
      .from('financeiro_parcelas')
      .select('lancamento_id')
      .eq('clinica_id', clinicaId)
      .eq('status', 'vencido')
      .in('lancamento_id', lancIds)

    const pacientesComVencido = new Set(
      (vencidosRaw ?? []).map((p: { lancamento_id: string }) =>
        lancPacMap[p.lancamento_id]
      ).filter(Boolean)
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
