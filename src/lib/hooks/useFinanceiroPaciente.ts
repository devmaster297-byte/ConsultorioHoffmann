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
  totalOrcado: number       // soma de valor_total dos lançamentos
  totalPago: number         // soma de todos os pagamentos realizados
  saldoDevedor: number      // totalOrcado - totalPago
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

    // Buscar parcelas (pagamentos realizados = status pago ou pago_parcial)
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

    // Agrupar parcelas por lançamento e calcular valores
    const parcelasPorLanc: Record<string, typeof parcelas> = {}
    for (const p of parcelas) {
      if (!parcelasPorLanc[p.lancamento_id]) parcelasPorLanc[p.lancamento_id] = []
      parcelasPorLanc[p.lancamento_id].push(p)
    }

    // Montar lançamentos com pagamentos
    const lancamentosCompletos: LancamentoPaciente[] = lancs.map((l) => {
      const parcsDoLanc = parcelasPorLanc[l.id] ?? []
      const valorPago = parcsDoLanc
        .filter((p) => p.status === 'pago' || p.status === 'pago_parcial')
        .reduce((acc, p) => acc + (p.valor_pago ?? 0), 0)

      const pgtos: PagamentoRegistrado[] = parcsDoLanc
        .filter((p) => p.status === 'pago' || p.status === 'pago_parcial')
        .map((p) => ({
          id: p.id,
          lancamento_id: l.id,
          valor_pago: p.valor_pago ?? p.valor,
          data_pagamento: p.data_pagamento ?? '',
          forma_pagamento: null, // vamos adicionar esse campo
          observacao: null,
          descricao_lancamento: l.descricao,
        }))

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

    // Todos os pagamentos em ordem cronológica inversa
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
  lancamentoId: string       // lançamento que está sendo abatido
  valor: number
  formaPagamento: string
  dataPagamento: string      // YYYY-MM-DD
  observacao?: string
}

export async function registrarPagamentoPaciente(
  input: RegistrarPagamentoInput
): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = createClient()

  // Buscar parcelas pendentes/pago_parcial desse lançamento em ordem
  const { data: parcelasRaw } = await supabase
    .from('financeiro_parcelas')
    .select('id, valor, valor_pago, status, numero')
    .eq('lancamento_id', input.lancamentoId)
    .in('status', ['pendente', 'pago_parcial', 'vencido'])
    .order('numero')

  const parcelas = (parcelasRaw ?? []) as Array<{
    id: string
    valor: number
    valor_pago: number | null
    status: string
    numero: number
  }>

  if (parcelas.length === 0) {
    // Lançamento já está totalmente pago — mas ainda assim registra
    // Busca a última parcela paga e atualiza
    const { data: ultimaRaw } = await supabase
      .from('financeiro_parcelas')
      .select('id, valor, valor_pago, status')
      .eq('lancamento_id', input.lancamentoId)
      .order('numero', { ascending: false })
      .limit(1)
      .single()

    if (!ultimaRaw) return { sucesso: false, erro: 'Nenhuma parcela encontrada' }

    await supabase
      .from('financeiro_parcelas')
      .update({
        valor_pago: (ultimaRaw as { valor_pago: number | null }).valor_pago ?? 0 + input.valor,
        data_pagamento: input.dataPagamento,
        status: 'pago',
      })
      .eq('id', (ultimaRaw as { id: string }).id)

    return { sucesso: true }
  }

  // Distribuir o valor pago pelas parcelas pendentes em ordem
  let valorRestante = input.valor

  for (const parcela of parcelas) {
    if (valorRestante <= 0) break

    const jaPago = parcela.valor_pago ?? 0
    const faltaPagar = parcela.valor - jaPago

    if (faltaPagar <= 0) continue

    const abonar = Math.min(valorRestante, faltaPagar)
    const novoPago = jaPago + abonar
    const novoStatus = novoPago >= parcela.valor ? 'pago' : 'pago_parcial'

    const { error } = await supabase
      .from('financeiro_parcelas')
      .update({
        valor_pago: Number(novoPago.toFixed(2)),
        data_pagamento: input.dataPagamento,
        status: novoStatus,
      })
      .eq('id', parcela.id)

    if (error) return { sucesso: false, erro: 'Erro ao atualizar parcela' }

    valorRestante = Number((valorRestante - abonar).toFixed(2))
  }

  return { sucesso: true }
}