// src/lib/hooks/usePacienteStatus.ts
import { supabase } from '@/lib/supabase-browser'
import { buscarSaldosOrcamentosAprovados } from '@/lib/hooks/useFinanceiro'

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

  const { data: lancamentosRaw } = await supabase
    .from('financeiro_lancamentos')
    .select('id')
    .eq('clinica_id', clinicaId)
    .eq('paciente_id', pacienteId)

  const lancamentos = (lancamentosRaw || []) as LancamentoStatusRow[]

  let statusViaParcelas: StatusFinanceiro = 'em_dia'
  if (lancamentos.length > 0) {
    const lancamentoIds = lancamentos.map((l) => l.id)

    const { data: parcelasRaw } = await supabase
      .from('financeiro_parcelas')
      .select('status')
      .eq('clinica_id', clinicaId)
      .in('lancamento_id', lancamentoIds)
      .neq('status', 'pago')

    const parcelas = (parcelasRaw || []) as { status: string }[]

    if (parcelas.some((p) => p.status === 'vencido')) statusViaParcelas = 'vencido'
    else if (parcelas.some((p) => p.status === 'pendente' || p.status === 'pago_parcial')) statusViaParcelas = 'pendente'
  }

  if (statusViaParcelas === 'vencido') return 'vencido'

  // CORREÇÃO: orçamento aprovado sem nenhum pagamento ainda não gera linha em
  // financeiro_lancamentos/financeiro_parcelas, então ficava marcado "em dia"
  // mesmo havendo saldo a receber. Verificamos esse saldo separadamente.
  const saldosOrcamento = await buscarSaldosOrcamentosAprovados(clinicaId, [pacienteId])
  if (saldosOrcamento.length > 0) return 'pendente'

  return statusViaParcelas
}

export async function calcularStatusEmBatch(
  pacienteIds: string[],
  clinicaId: string
): Promise<Record<string, StatusFinanceiro>> {
  if (pacienteIds.length === 0) return {}


  const { data: lancamentosRaw } = await supabase
    .from('financeiro_lancamentos')
    .select('id, paciente_id')
    .eq('clinica_id', clinicaId)
    .in('paciente_id', pacienteIds)

  const lancamentos = (lancamentosRaw || []) as LancamentoStatusRow[]

  const statusPorPaciente: Record<string, StatusFinanceiro> = Object.fromEntries(
    pacienteIds.map((id) => [id, 'em_dia' as StatusFinanceiro])
  )

  if (lancamentos.length > 0) {
    const lancamentoIds = lancamentos.map((l) => l.id)
    const lancamentoPacienteMap = Object.fromEntries(
      lancamentos.map((l) => [l.id, l.paciente_id])
    )

    const { data: parcelasRaw } = await supabase
      .from('financeiro_parcelas')
      .select('lancamento_id, status')
      .in('lancamento_id', lancamentoIds)
      .neq('status', 'pago')

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
  }

  // CORREÇÃO: orçamentos aprovados sem nenhum pagamento ainda não geram linha
  // em financeiro_lancamentos/financeiro_parcelas (só nascem no momento do
  // primeiro pagamento, com status 'pago'). Isso fazia pacientes com saldo de
  // orçamento em aberto aparecerem como "em dia" na lista. Verificamos esse
  // saldo separadamente e marcamos como "pendente" (não sobrescreve "vencido").
  const saldosOrcamento = await buscarSaldosOrcamentosAprovados(clinicaId, pacienteIds)
  for (const s of saldosOrcamento) {
    if (statusPorPaciente[s.paciente_id] !== 'vencido') {
      statusPorPaciente[s.paciente_id] = 'pendente'
    }
  }

  return statusPorPaciente
}