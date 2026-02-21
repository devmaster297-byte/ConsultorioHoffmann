// src/lib/hooks/usePacienteStatus.ts
import { createClient } from '@/lib/supabase/client'

export type StatusFinanceiro = 'em_dia' | 'pendente' | 'vencido'

export async function calcularStatusFinanceiro(
  pacienteId: string,
  clinicaId: string
): Promise<StatusFinanceiro> {
  const supabase = createClient()

  // 1. Buscar IDs dos lançamentos do paciente
  const { data: lancamentos } = await supabase
    .from('financeiro_lancamentos')
    .select('id')
    .eq('clinica_id', clinicaId)
    .eq('paciente_id', pacienteId)

  if (!lancamentos || lancamentos.length === 0) return 'em_dia'

  const lancamentoIds = lancamentos.map((l) => l.id)

  // 2. Buscar parcelas desses lançamentos
  const { data: parcelas } = await supabase
    .from('financeiro_parcelas')
    .select('status')
    .eq('clinica_id', clinicaId)
    .in('lancamento_id', lancamentoIds)
    .neq('status', 'pago')

  if (!parcelas || parcelas.length === 0) return 'em_dia'

  if (parcelas.some((p) => p.status === 'vencido')) return 'vencido'
  if (parcelas.some((p) => p.status === 'pendente' || p.status === 'pago_parcial')) return 'pendente'

  return 'em_dia'
}

// Versão otimizada: busca status de múltiplos pacientes em batch
export async function calcularStatusEmBatch(
  pacienteIds: string[],
  clinicaId: string
): Promise<Record<string, StatusFinanceiro>> {
  if (pacienteIds.length === 0) return {}

  const supabase = createClient()

  const { data: lancamentos } = await supabase
    .from('financeiro_lancamentos')
    .select('id, paciente_id')
    .eq('clinica_id', clinicaId)
    .in('paciente_id', pacienteIds)

  // Inicializar todos como em_dia
  const statusPorPaciente: Record<string, StatusFinanceiro> = Object.fromEntries(
    pacienteIds.map((id) => [id, 'em_dia' as StatusFinanceiro])
  )

  if (!lancamentos || lancamentos.length === 0) return statusPorPaciente

  const lancamentoIds = lancamentos.map((l) => l.id)
  const lancamentoPacienteMap = Object.fromEntries(
    lancamentos.map((l) => [l.id, l.paciente_id])
  )

  const { data: parcelas } = await supabase
    .from('financeiro_parcelas')
    .select('lancamento_id, status')
    .in('lancamento_id', lancamentoIds)
    .neq('status', 'pago')

  parcelas?.forEach((parcela) => {
    const pacienteId = lancamentoPacienteMap[parcela.lancamento_id]
    if (!pacienteId) return

    if (parcela.status === 'vencido') {
      statusPorPaciente[pacienteId] = 'vencido'
    } else if (
      statusPorPaciente[pacienteId] !== 'vencido' &&
      (parcela.status === 'pendente' || parcela.status === 'pago_parcial')
    ) {
      statusPorPaciente[pacienteId] = 'pendente'
    }
  })

  return statusPorPaciente
}