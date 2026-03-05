// src/lib/hooks/useFinanceiroPaciente.ts
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PagamentoRegistrado {
  id: string
  lancamento_id: string
  valor_pago: number
  data_pagamento: string
  forma_pagamento: string | null
  observacao: string | null
  descricao_lancamento: string
}

export interface LancamentoPaciente {
  id: string
  descricao: string
  valor_total: number
  valor_pago: number
  valor_pendente: number
  num_parcelas: number
  created_at: string
  orcamento_id: string | null   // ✅ FIX MELHORIA 2: campo presente no tipo
  atendimento_id: string | null
  pagamentos: PagamentoRegistrado[]
}

export interface ResumoFinanceiroPaciente {
  totalOrcado: number
  totalPago: number
  saldoDevedor: number
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFinanceiroPaciente(pacienteId: string, clinicaId: string) {
  const [lancamentos, setLancamentos] = useState<LancamentoPaciente[]>([])
  const [pagamentos, setPagamentos] = useState<PagamentoRegistrado[]>([])
  const [resumo, setResumo] = useState<ResumoFinanceiroPaciente>({
    totalOrcado: 0,
    totalPago: 0,
    saldoDevedor: 0,
  })
  const [carregando, setCarregando] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>('')

  const carregar = useCallback(async () => {
    if (!pacienteId || !clinicaId) return
    setCarregando(true)

    const supabase = createClient()

    // ✅ FIX MELHORIA 2: incluir orcamento_id na query
    const { data: lancsRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, valor_total, num_parcelas, created_at, atendimento_id, orcamento_id')
      .eq('clinica_id', clinicaId)
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'receita')
      .order('created_at', { ascending: false })

    const lancs = (lancsRaw ?? []) as Array<{
      id: string
      descricao: string
      valor_total: number
      num_parcelas: number
      created_at: string
      atendimento_id: string | null
      orcamento_id: string | null  // ✅ agora incluso
    }>

    if (lancs.length === 0) {
      setLancamentos([])
      setPagamentos([])
      setResumo({ totalOrcado: 0, totalPago: 0, saldoDevedor: 0 })
      setCarregando(false)
      setUltimaAtualizacao(new Date().toLocaleTimeString('pt-BR'))
      return
    }

    const lancIds = lancs.map((l) => l.id)

    // Buscar TODAS as parcelas do lançamento
    const { data: parcelasRaw } = await supabase
      .from('financeiro_parcelas')
      .select('id, lancamento_id, valor, valor_pago, data_pagamento, status, numero')
      .in('lancamento_id', lancIds)
      .order('data_pagamento', { ascending: false })

    const parcelas = (parcelasRaw ?? []) as Array<{
      id: string
      lancamento_id: string
      valor: number
      valor_pago: number | null
      data_pagamento: string | null
      status: string
      numero: number
    }>

    const parcelasPorLanc: Record<string, typeof parcelas> = {}
    for (const p of parcelas) {
      if (!parcelasPorLanc[p.lancamento_id]) parcelasPorLanc[p.lancamento_id] = []
      parcelasPorLanc[p.lancamento_id].push(p)
    }

    const lancamentosCompletos: LancamentoPaciente[] = lancs.map((l) => {
      const parcsDoLanc = parcelasPorLanc[l.id] ?? []

      const valorPago = parcsDoLanc
        .filter((p) => p.status === 'pago')
        .reduce((acc, p) => acc + (p.valor_pago ?? p.valor), 0)

      const pgtos: PagamentoRegistrado[] = parcsDoLanc
        .filter((p) => p.status === 'pago' && p.data_pagamento)
        .map((p) => ({
          id: p.id,
          lancamento_id: l.id,
          valor_pago: p.valor_pago ?? p.valor,
          data_pagamento: p.data_pagamento!,
          forma_pagamento: null,
          observacao: null,
          descricao_lancamento: l.descricao,
        }))
        .sort((a, b) => b.data_pagamento.localeCompare(a.data_pagamento))

      return {
        id: l.id,
        descricao: l.descricao,
        valor_total: l.valor_total,
        valor_pago: valorPago,
        valor_pendente: Math.max(0, l.valor_total - valorPago),
        num_parcelas: l.num_parcelas,
        created_at: l.created_at,
        orcamento_id: l.orcamento_id,      // ✅ populado corretamente
        atendimento_id: l.atendimento_id,
        pagamentos: pgtos,
      }
    })

    const todosPagamentos: PagamentoRegistrado[] = lancamentosCompletos
      .flatMap((l) => l.pagamentos)
      .sort((a, b) => b.data_pagamento.localeCompare(a.data_pagamento))

    const totalOrcado = lancamentosCompletos.reduce((acc, l) => acc + l.valor_total, 0)
    const totalPago = lancamentosCompletos.reduce((acc, l) => acc + l.valor_pago, 0)

    setLancamentos(lancamentosCompletos)
    setPagamentos(todosPagamentos)
    setResumo({
      totalOrcado,
      totalPago,
      saldoDevedor: Math.max(0, totalOrcado - totalPago),
    })
    setCarregando(false)
    setUltimaAtualizacao(new Date().toLocaleTimeString('pt-BR'))
  }, [pacienteId, clinicaId])

  return { lancamentos, pagamentos, resumo, carregando, ultimaAtualizacao, recarregar: carregar }
}

// ─── Registrar Pagamento ──────────────────────────────────────────────────────

export interface RegistrarPagamentoInput {
  clinicaId: string
  pacienteId: string
  lancamentoId: string
  valor: number
  formaPagamento: string
  dataPagamento: string   // YYYY-MM-DD
  observacao?: string
}

export async function registrarPagamentoPaciente(
  input: RegistrarPagamentoInput
): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = createClient()

  // Verificar saldo disponível
  const { data: parcelasRaw } = await supabase
    .from('financeiro_parcelas')
    .select('id, valor, valor_pago, status, numero')
    .eq('lancamento_id', input.lancamentoId)
    .order('numero')

  const parcelas = (parcelasRaw ?? []) as Array<{
    id: string; valor: number; valor_pago: number | null; status: string; numero: number
  }>

  // Total já pago (apenas parcelas com status pago)
  const totalJaPago = parcelas
    .filter((p) => p.status === 'pago')
    .reduce((acc, p) => acc + (p.valor_pago ?? p.valor), 0)

  // Valor total do lançamento
  const { data: lancRaw } = await supabase
    .from('financeiro_lancamentos')
    .select('valor_total')
    .eq('id', input.lancamentoId)
    .single()

  const valorTotal = (lancRaw as { valor_total: number } | null)?.valor_total ?? 0
  const saldoDisponivel = Math.max(0, valorTotal - totalJaPago)

  if (saldoDisponivel <= 0) {
    return { sucesso: false, erro: 'Este lançamento já está totalmente pago' }
  }

  // Valor a registrar — limita ao saldo disponível
  const valorRegistrar = Math.min(input.valor, saldoDisponivel)

  // Próximo número de parcela
  const proximoNumero = parcelas.length + 1

  // Criar nova parcela para este pagamento
  const { error } = await supabase
    .from('financeiro_parcelas')
    .insert({
      lancamento_id: input.lancamentoId,
      clinica_id: input.clinicaId,
      numero: proximoNumero,
      valor: Number(valorRegistrar.toFixed(2)),
      valor_pago: Number(valorRegistrar.toFixed(2)),
      data_vencimento: input.dataPagamento,
      data_pagamento: input.dataPagamento,
      status: 'pago',
    })

  if (error) return { sucesso: false, erro: 'Erro ao registrar pagamento' }

  return { sucesso: true }
}

// ─── Excluir Pagamento ────────────────────────────────────────────────────────

export async function excluirPagamentoParcela(
  parcelaId: string
): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = createClient()

  const { error } = await supabase
    .from('financeiro_parcelas')
    .delete()
    .eq('id', parcelaId)

  if (error) return { sucesso: false, erro: 'Erro ao excluir pagamento' }
  return { sucesso: true }
}