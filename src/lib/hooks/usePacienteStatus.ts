// src/lib/hooks/usePacienteStatus.ts
import { createClient } from '@/lib/supabase/client'

export type StatusFinanceiro = 'em_dia' | 'pendente' | 'vencido'

// Interfaces para tipagem explícita do Supabase
interface LancamentoStatusRow {
  id: string
  paciente_id: string | null
}

interface ParcelaStatusRow {
  lancamento_id: string
  status: string
}

export async function calcularStatusFinanceiro(
  pacienteId: string,
  clinicaId: string
): Promise<StatusFinanceiro> {
  const supabase = createClient()

  const { data: lancamentosRaw } = await supabase
    .from('financeiro_lancamentos')
    .select('id')
    .eq('clinica_id', clinicaId)
    .eq('paciente_id', pacienteId)

  const lancamentos = (lancamentosRaw || []) as LancamentoStatusRow[]
  if (lancamentos.length === 0) return 'em_dia'

  const lancamentoIds = lancamentos.map((l) => l.id)

  const { data: parcelasRaw } = await supabase
    .from('financeiro_parcelas')
    .select('status')
    .eq('clinica_id', clinicaId)
    .in('lancamento_id', lancamentoIds)
    .neq('status', 'pago')
    .neq('status', 'cancelado') // ✅ FIX ITEM 5: ignorar parcelas canceladas

  const parcelas = (parcelasRaw || []) as { status: string }[]

  if (parcelas.length === 0) return 'em_dia'

  if (parcelas.some((p) => p.status === 'vencido')) return 'vencido'
  if (parcelas.some((p) => p.status === 'pendente' || p.status === 'pago_parcial')) return 'pendente'

  return 'em_dia'
}

export async function calcularStatusEmBatch(
  pacienteIds: string[],
  clinicaId: string
): Promise<Record<string, StatusFinanceiro>> {
  if (pacienteIds.length === 0) return {}

  const supabase = createClient()

  const { data: lancamentosRaw } = await supabase
    .from('financeiro_lancamentos')
    .select('id, paciente_id')
    .eq('clinica_id', clinicaId)
    .in('paciente_id', pacienteIds)

  const lancamentos = (lancamentosRaw || []) as LancamentoStatusRow[]

  const statusPorPaciente: Record<string, StatusFinanceiro> = Object.fromEntries(
    pacienteIds.map((id) => [id, 'em_dia' as StatusFinanceiro])
  )

  if (lancamentos.length === 0) return statusPorPaciente

  const lancamentoIds = lancamentos.map((l) => l.id)
  const lancamentoPacienteMap = Object.fromEntries(
    lancamentos.map((l) => [l.id, l.paciente_id])
  )

  const { data: parcelasRaw } = await supabase
    .from('financeiro_parcelas')
    .select('lancamento_id, status')
    .in('lancamento_id', lancamentoIds)
    .neq('status', 'pago')
    .neq('status', 'cancelado') // ✅ FIX ITEM 5: ignorar parcelas canceladas

  // Casting aplicado aqui: o TypeScript agora conhece o tipo da 'parcela'
  const parcelas = (parcelasRaw || []) as ParcelaStatusRow[]

  parcelas.forEach((parcela) => {
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