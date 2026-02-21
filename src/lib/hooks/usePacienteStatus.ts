// src/lib/hooks/usePacienteStatus.ts
import { createClient } from '@/lib/supabase/client'

export type StatusFinanceiro = 'em_dia' | 'pendente' | 'vencido'

export async function calcularStatusFinanceiro(
  pacienteId: string,
  clinicaId: string
): Promise<StatusFinanceiro> {
  const supabase = createClient()

  // Busca parcelas do paciente via lançamentos
  const { data: parcelas } = await supabase
    .from('financeiro_parcelas')
    .select('status, data_vencimento')
    .eq('clinica_id', clinicaId)
    .in(
      'lancamento_id',
      supabase
        .from('financeiro_lancamentos')
        .select('id')
        .eq('paciente_id', pacienteId)
        .eq('clinica_id', clinicaId)
    )

  if (!parcelas || parcelas.length === 0) return 'em_dia'

  const temVencida = parcelas.some((p) => p.status === 'vencido')
  if (temVencida) return 'vencido'

  const temPendente = parcelas.some(
    (p) => p.status === 'pendente' || p.status === 'pago_parcial'
  )
  if (temPendente) return 'pendente'

  return 'em_dia'
}

// Versão otimizada: busca status de múltiplos pacientes em batch
export async function calcularStatusEmBatch(
  pacienteIds: string[],
  clinicaId: string
): Promise<Record<string, StatusFinanceiro>> {
  const supabase = createClient()

  const { data: lancamentos } = await supabase
    .from('financeiro_lancamentos')
    .select('id, paciente_id')
    .eq('clinica_id', clinicaId)
    .in('paciente_id', pacienteIds)

  if (!lancamentos || lancamentos.length === 0) {
    return Object.fromEntries(pacienteIds.map((id) => [id, 'em_dia' as StatusFinanceiro]))
  }

  const lancamentoIds = lancamentos.map((l) => l.id)
  const lancamentoPacienteMap = Object.fromEntries(
    lancamentos.map((l) => [l.id, l.paciente_id])
  )

  const { data: parcelas } = await supabase
    .from('financeiro_parcelas')
    .select('lancamento_id, status')
    .in('lancamento_id', lancamentoIds)
    .neq('status', 'pago')

  const statusPorPaciente: Record<string, StatusFinanceiro> = {}

  // Inicializar todos como em_dia
  pacienteIds.forEach((id) => {
    statusPorPaciente[id] = 'em_dia'
  })

  parcelas?.forEach((parcela) => {
    const pacienteId = lancamentoPacienteMap[parcela.lancamento_id]
    if (!pacienteId) return

    const statusAtual = statusPorPaciente[pacienteId]

    if (parcela.status === 'vencido') {
      statusPorPaciente[pacienteId] = 'vencido'
    } else if (
      statusAtual !== 'vencido' &&
      (parcela.status === 'pendente' || parcela.status === 'pago_parcial')
    ) {
      statusPorPaciente[pacienteId] = 'pendente'
    }
  })

  return statusPorPaciente
}
