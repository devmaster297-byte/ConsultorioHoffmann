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
  orcamento_id: string | null
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

    // Buscar lançamentos de receita do paciente
    const { data: lancsRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, valor_total, num_parcelas, created_at, atendimento_id')
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
      .select('id, lancamento_id, valor, valor_pago, data_pagamento, status, numero, forma_pagamento')
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
      forma_pagamento: string | null
    }>

    const parcelasPorLanc: Record<string, typeof parcelas> = {}
    for (const p of parcelas) {
      if (!parcelasPorLanc[p.lancamento_id]) parcelasPorLanc[p.lancamento_id] = []
      parcelasPorLanc[p.lancamento_id].push(p)
    }

    const lancamentosCompletos: LancamentoPaciente[] = lancs.map((l) => {
      const parcsDoLanc = parcelasPorLanc[l.id] ?? []

      // Valor pago = soma de todas as parcelas com status pago
      // (cada entrada na lista de pagamentos é uma parcela separada)
      const valorPago = parcsDoLanc
        .filter((p) => p.status === 'pago')
        .reduce((acc, p) => acc + (p.valor_pago ?? p.valor), 0)

      // Cada parcela paga = um pagamento individual no histórico
      const pgtos: PagamentoRegistrado[] = parcsDoLanc
        .filter((p) => p.status === 'pago' && p.data_pagamento)
        .map((p) => ({
          id: p.id,
          lancamento_id: l.id,
          valor_pago: p.valor_pago ?? p.valor,
          data_pagamento: p.data_pagamento!,
          forma_pagamento: p.forma_pagamento ?? null,
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
        orcamento_id: null,
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
// Cada pagamento cria uma NOVA parcela com status 'pago'.
// Isso preserva o histórico completo — cada entrada é imutável.

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

  // Valor total do lançamento (inclui descricao para extrair orc_id se necessário)
  const { data: lancRaw } = await supabase
    .from('financeiro_lancamentos')
    .select('valor_total, descricao')
    .eq('id', input.lancamentoId)
    .single()

  const lancamento = lancRaw as { valor_total: number; descricao: string } | null
  let valorTotal = lancamento?.valor_total ?? 0
  let saldoDisponivel = Math.max(0, valorTotal - totalJaPago)

  // ── Autocorreção: lançamento "pago" mas orçamento tem saldo restante ──────
  // Ocorre quando o lançamento foi criado com valor_total menor que o orçamento.
  // O valor real do orçamento é a soma dos itens em orcamento_itens.
  // Corrige o valor_total do lançamento silenciosamente antes de prosseguir.
  if (saldoDisponivel <= 0 && lancamento?.descricao) {
    const matchOrc = lancamento.descricao.match(/\[orc:([a-f0-9-]+)\]/i)
    if (matchOrc) {
      const orcId = matchOrc[1]

      // Soma os itens do orçamento para obter o valor real
      const { data: itensRaw } = await supabase
        .from('orcamento_itens')
        .select('valor')
        .eq('orcamento_id', orcId)

      const valorOrcamento = (itensRaw ?? []).reduce(
        (acc, item) => acc + ((item as { valor: number }).valor ?? 0),
        0
      )

      if (valorOrcamento > totalJaPago) {
        // Corrige o valor_total do lançamento para bater com o orçamento
        await supabase
          .from('financeiro_lancamentos')
          .update({ valor_total: Number(valorOrcamento.toFixed(2)) })
          .eq('id', input.lancamentoId)

        valorTotal = valorOrcamento
        saldoDisponivel = Math.max(0, valorTotal - totalJaPago)
      }
    }
  }

  if (saldoDisponivel <= 0) {
    return { sucesso: false, erro: 'Este lançamento já está totalmente pago' }
  }

  // Valor a registrar — limita ao saldo disponível
  const valorRegistrar = Math.min(input.valor, saldoDisponivel)

  // Próximo número de parcela — usa o maior numero existente + 1 para evitar
  // colisão de unique constraint quando parcelas anteriores foram canceladas
  const proximoNumero = parcelas.length > 0
    ? Math.max(...parcelas.map((p) => p.numero)) + 1
    : 1

  // Criar nova parcela para este pagamento
  const { error } = await supabase
    .from('financeiro_parcelas')
    .insert({
      lancamento_id:   input.lancamentoId,
      clinica_id:      input.clinicaId,
      numero:          proximoNumero,
      valor:           Number(valorRegistrar.toFixed(2)),
      valor_pago:      Number(valorRegistrar.toFixed(2)),
      data_vencimento: input.dataPagamento,
      data_pagamento:  input.dataPagamento,
      status:          'pago',
      forma_pagamento: input.formaPagamento || null,
    })

  if (error) return { sucesso: false, erro: 'Erro ao registrar pagamento' }

  // Mantém num_parcelas em sincronia com a contagem real de parcelas do lançamento
  await supabase
    .from('financeiro_lancamentos')
    .update({ num_parcelas: proximoNumero })
    .eq('id', input.lancamentoId)

  return { sucesso: true }
}

// ─── Excluir Pagamento ────────────────────────────────────────────────────────
// Marca a parcela como cancelada (soft delete) — preserva o histórico financeiro
// e evita lacunas na sequência de numeros que causariam falha no próximo registro.
// Se todas as parcelas do lançamento ficarem canceladas (sem nenhuma paga),
// o lançamento é deletado — evita o "fantasma financeiro" da Raiane.

export async function excluirPagamentoParcela(
  parcelaId: string
): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = createClient()

  // 1. Buscar o lancamento_id antes de cancelar
  const { data: parcelaAtual } = await supabase
    .from('financeiro_parcelas')
    .select('lancamento_id')
    .eq('id', parcelaId)
    .single()

  // 2. Marcar como cancelada
  const { error } = await supabase
    .from('financeiro_parcelas')
    .update({
      status: 'cancelado',
      data_pagamento: null,
      valor_pago: null,
    })
    .eq('id', parcelaId)

  if (error) return { sucesso: false, erro: 'Erro ao excluir pagamento' }

  // 3. Verificar se o lançamento ficou sem nenhuma parcela paga
  //    (todas canceladas ou nenhuma) → deletar para não criar fantasmas
  if (parcelaAtual?.lancamento_id) {
    const lancId = parcelaAtual.lancamento_id

    const { data: restantes } = await supabase
      .from('financeiro_parcelas')
      .select('status')
      .eq('lancamento_id', lancId)

    const todas = (restantes ?? []) as { status: string }[]
    const temPaga = todas.some(p => p.status === 'pago' || p.status === 'pago_parcial')

    if (!temPaga) {
      // Nenhuma parcela paga restante — deletar parcelas e lançamento
      await supabase
        .from('financeiro_parcelas')
        .delete()
        .eq('lancamento_id', lancId)

      await supabase
        .from('financeiro_lancamentos')
        .delete()
        .eq('id', lancId)
    }
  }

  return { sucesso: true }
}