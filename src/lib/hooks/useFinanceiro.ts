// src/lib/hooks/useFinanceiro.ts
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FinanceiroParcela } from '@/lib/supabase/types'

// ─── Tipos das Queries ────────────────────────────────────────────────────────

interface LancamentoRow {
  id: string
  tipo: 'receita' | 'despesa'
  descricao: string
  valor_total: number
  paciente_id?: string | null
  atendimento_id?: string | null
}

interface ParcelaRow {
  id: string
  lancamento_id: string
  clinica_id: string
  numero: number
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  status: 'pendente' | 'pago' | 'pago_parcial' | 'vencido' | 'cancelado'
  created_at: string
  updated_at: string
}

interface PacienteRow {
  id: string
  nome: string
}

// ─── Tipos Exportados ─────────────────────────────────────────────────────────

export interface MetricasMensais {
  totalRecebido: number
  totalPendente: number
  totalDespesas: number
  saldo: number
}


export interface ParcelaComLancamento extends Omit<FinanceiroParcela, 'status'> {
  status: 'pendente' | 'pago' | 'pago_parcial' | 'vencido' | 'cancelado'
  lancamento: {
    id: string
    descricao: string
    tipo: 'receita' | 'despesa'
    paciente_id: string | null
    atendimento_id: string | null
  }
  paciente_nome: string | null
}

export interface Inadimplente {
  paciente_id: string
  paciente_nome: string
  total_vencido: number
  parcelas: ParcelaComLancamento[]
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useFinanceiro(clinicaId: string, mes?: string) {
  const [metricas, setMetricas] = useState<MetricasMensais>({
    totalRecebido: 0,
    totalPendente: 0,
    totalDespesas: 0,
    saldo: 0,
  })
  const [proximosVencimentos, setProximosVencimentos] = useState<ParcelaComLancamento[]>([])
  const [carregando, setCarregando] = useState(true)

  const mesAtual = mes ?? new Date().toISOString().slice(0, 7)
  const ano = Number(mesAtual.split('-')[0])
  const mesNum = Number(mesAtual.split('-')[1])

  const inicioMes = `${mesAtual}-01`
  const fimMes = new Date(ano, mesNum, 0).toISOString().split('T')[0]

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)

    const supabase = createClient()

    // Buscar todos os lançamentos do mês com parcelas
    const { data: lancamentosRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, tipo, descricao, valor_total')
      .eq('clinica_id', clinicaId)

    const lancamentos = (lancamentosRaw ?? []) as unknown as LancamentoRow[]
    const lancIds = lancamentos.map((l) => l.id)
    const lancMap: Record<string, LancamentoRow> = Object.fromEntries(
      lancamentos.map((l) => [l.id, l])
    )

    // Parcelas com vencimento neste mês
    let parcelasMes: ParcelaRow[] = []
    if (lancIds.length > 0) {
      const { data: parcelasMesRaw } = await supabase
        .from('financeiro_parcelas')
        .select('*')
        .eq('clinica_id', clinicaId)
        .in('lancamento_id', lancIds)
        .gte('data_vencimento', inicioMes)
        .lte('data_vencimento', fimMes)

      parcelasMes = (parcelasMesRaw ?? []) as unknown as ParcelaRow[]
    }

    // Calcular métricas
    let totalRecebido = 0
    let totalPendente = 0
    let totalDespesas = 0

    for (const p of parcelasMes) {
      const lanc = lancMap[p.lancamento_id]
      if (!lanc) continue

      if (lanc.tipo === 'despesa') {
        totalDespesas += p.valor_pago ?? p.valor
        continue
      }

      // Receita
      if (p.status === 'pago') {
        totalRecebido += p.valor_pago ?? p.valor
      } else if (p.status === 'pago_parcial') {
        totalRecebido += p.valor_pago ?? 0
        totalPendente += p.valor - (p.valor_pago ?? 0)
      } else {
        // pendente ou vencido
        totalPendente += p.valor
      }
    }

    setMetricas({
      totalRecebido,
      totalPendente,
      totalDespesas,
      saldo: totalRecebido - totalDespesas,
    })

    // Próximos vencimentos (próximos 7 dias, apenas receitas pendentes)
    const hoje = new Date().toISOString().split('T')[0]
    const em7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let proxVenc: ParcelaRow[] = []
    if (lancIds.length > 0) {
      const { data: proxVencRaw } = await supabase
        .from('financeiro_parcelas')
        .select('*')
        .eq('clinica_id', clinicaId)
        .in('lancamento_id', lancIds)
        .in('status', ['pendente', 'pago_parcial'])
        .gte('data_vencimento', hoje)
        .lte('data_vencimento', em7Dias)
        .order('data_vencimento')
        .limit(10)

      proxVenc = (proxVencRaw ?? []) as unknown as ParcelaRow[]
    }

    // Enriquecer com dados do lançamento e paciente
    const proxComPaciente = await enriquecerParcelas(proxVenc, clinicaId)
    setProximosVencimentos(proxComPaciente)

    setCarregando(false)
  }, [clinicaId, mesAtual, inicioMes, fimMes])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { metricas, proximosVencimentos, carregando, recarregar: carregar }
}

// ─── Inadimplentes ────────────────────────────────────────────────────────────

export function useInadimplentes(clinicaId: string) {
  const [inadimplentes, setInadimplentes] = useState<Inadimplente[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)

    const supabase = createClient()

    // Lançamentos de receita com paciente vinculado
    const { data: lancamentosRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, paciente_id, atendimento_id, tipo, valor_total')
      .eq('clinica_id', clinicaId)
      .eq('tipo', 'receita')
      .not('paciente_id', 'is', null)

    const lancamentos = (lancamentosRaw ?? []) as unknown as LancamentoRow[]
    const lancIds = lancamentos.map((l) => l.id)

    if (lancIds.length === 0) {
      setInadimplentes([])
      setCarregando(false)
      return
    }

    const lancMap: Record<string, LancamentoRow> = Object.fromEntries(
      lancamentos.map((l) => [l.id, l])
    )

    // Todas as parcelas pendentes, pago_parcial ou vencidas (qualquer saldo aberto)
    const { data: parcelasRaw } = await supabase
      .from('financeiro_parcelas')
      .select('*')
      .eq('clinica_id', clinicaId)
      .in('lancamento_id', lancIds)
      .in('status', ['pendente', 'pago_parcial', 'vencido'])
      .order('data_vencimento')

    const parcelas = (parcelasRaw ?? []) as unknown as ParcelaRow[]

    if (parcelas.length === 0) {
      setInadimplentes([])
      setCarregando(false)
      return
    }

    // Enriquecer com lançamento
    const comLancamento: ParcelaComLancamento[] = parcelas.map((p) => {
      const lanc = lancMap[p.lancamento_id]
      return {
        ...p,
        lancamento: {
          id: lanc?.id ?? '',
          descricao: lanc?.descricao ?? '',
          tipo: lanc?.tipo ?? 'receita',
          paciente_id: lanc?.paciente_id ?? null,
          atendimento_id: lanc?.atendimento_id ?? null,
        },
        paciente_nome: null,
      }
    })

    // Buscar nomes dos pacientes
    const pacienteIds = [
      ...new Set(
        comLancamento
          .map((p) => p.lancamento.paciente_id)
          .filter((id): id is string => id !== null && id !== undefined)
      ),
    ]

    let pacienteMap: Record<string, string> = {}
    if (pacienteIds.length > 0) {
      const { data: pacientesRaw } = await supabase
        .from('pacientes')
        .select('id, nome')
        .in('id', pacienteIds)

      const pacientes = (pacientesRaw ?? []) as unknown as PacienteRow[]
      pacienteMap = Object.fromEntries(pacientes.map((p) => [p.id, p.nome]))
    }

    const parcelasComNome: ParcelaComLancamento[] = comLancamento.map((p) => ({
      ...p,
      paciente_nome: p.lancamento.paciente_id
        ? (pacienteMap[p.lancamento.paciente_id] ?? null)
        : null,
    }))

    // Agrupar por paciente — saldo = valor - valor_pago de cada parcela
    const grupos: Record<string, Inadimplente> = {}
    for (const p of parcelasComNome) {
      const pacId = p.lancamento.paciente_id
      if (!pacId) continue

      if (!grupos[pacId]) {
        grupos[pacId] = {
          paciente_id: pacId,
          paciente_nome: p.paciente_nome ?? 'Paciente',
          total_vencido: 0, // aqui vira "saldo pendente"
          parcelas: [],
        }
      }

      // Saldo real de cada parcela
      const saldoParcela = p.valor - (p.valor_pago ?? 0)
      grupos[pacId].total_vencido += saldoParcela
      grupos[pacId].parcelas.push(p)
    }

    // Ordenar por maior saldo pendente
    const lista = Object.values(grupos)
      .filter((g) => g.total_vencido > 0)
      .sort((a, b) => b.total_vencido - a.total_vencido)

    setInadimplentes(lista)
    setCarregando(false)
  }, [clinicaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { inadimplentes, carregando, recarregar: carregar }
}

// ─── Operações de baixa ───────────────────────────────────────────────────────

interface ParcelaValorRow {
  id: string
  valor: number
}

export async function baixarParcela(
  parcelaId: string,
  valorPago?: number
): Promise<boolean> {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { data: parcelaRaw } = await supabase
    .from('financeiro_parcelas')
    .select('valor')
    .eq('id', parcelaId)
    .single()

  const parcela = parcelaRaw as unknown as { valor: number } | null
  if (!parcela) return false

  const pago = valorPago ?? parcela.valor
  const status = pago >= parcela.valor ? 'pago' : 'pago_parcial'

  const { error } = await supabase
    .from('financeiro_parcelas')
    .update({
      status,
      valor_pago: pago,
      data_pagamento: hoje,
    })
    .eq('id', parcelaId)

  return !error
}

export async function baixarParcelasEmLote(parcelaIds: string[]): Promise<boolean> {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('financeiro_parcelas')
    .update({
      status: 'pago',
      data_pagamento: hoje,
    })
    .in('id', parcelaIds)

  if (!error) {
    // Atualizar valor_pago para cada parcela
    const { data: parcelasRaw } = await supabase
      .from('financeiro_parcelas')
      .select('id, valor')
      .in('id', parcelaIds)

    const parcelas = (parcelasRaw ?? []) as unknown as ParcelaValorRow[]

    if (parcelas.length > 0) {
      await Promise.all(
        parcelas.map((p) =>
          supabase
            .from('financeiro_parcelas')
            .update({ valor_pago: p.valor })
            .eq('id', p.id)
        )
      )
    }
  }

  return !error
}

// ─── Criar lançamento com parcelas ───────────────────────────────────────────

export interface CriarLancamentoInput {
  clinicaId: string
  pacienteId?: string
  atendimentoId?: string
  orcamentoId?: string
  tipo: 'receita' | 'despesa'
  descricao: string
  valorTotal: number
  numParcelas: number
  primeiroVencimento: string // "YYYY-MM-DD"
}

interface LancamentoCriadoRow {
  id: string
}

export async function criarLancamento(
  input: CriarLancamentoInput
): Promise<{ sucesso: boolean; erro?: string }> {
  const supabase = createClient()

  const { data: lancamentoRaw, error: lancErr } = await supabase
    .from('financeiro_lancamentos')
    .insert({
      clinica_id: input.clinicaId,
      paciente_id: input.pacienteId ?? null,
      atendimento_id: input.atendimentoId ?? null,
      tipo: input.tipo,
      descricao: input.descricao,
      valor_total: input.valorTotal,
      num_parcelas: input.numParcelas,
    })
    .select('id')
    .single()

  const lancamento = lancamentoRaw as unknown as LancamentoCriadoRow | null

  if (lancErr || !lancamento) {
    return { sucesso: false, erro: 'Erro ao criar lançamento' }
  }

  // Gerar parcelas
  const valorParcela = Number((input.valorTotal / input.numParcelas).toFixed(2))
  const parcelas = Array.from({ length: input.numParcelas }, (_, i) => {
    const dataVenc = new Date(input.primeiroVencimento)
    dataVenc.setMonth(dataVenc.getMonth() + i)

    // Ajuste de valor para a última parcela (diferença de arredondamento)
    const isUltima = i === input.numParcelas - 1
    const valorAcumulado = valorParcela * (input.numParcelas - 1)
    const valorFinal = isUltima
      ? Number((input.valorTotal - valorAcumulado).toFixed(2))
      : valorParcela

    return {
      lancamento_id: lancamento.id,
      clinica_id: input.clinicaId,
      numero: i + 1,
      valor: valorFinal,
      data_vencimento: dataVenc.toISOString().split('T')[0],
      status: 'pendente' as const,
    }
  })

  const { error: parcErr } = await supabase
    .from('financeiro_parcelas')
    .insert(parcelas)

  if (parcErr) {
    // Rollback: deletar lançamento
    await supabase.from('financeiro_lancamentos').delete().eq('id', lancamento.id)
    return { sucesso: false, erro: 'Erro ao criar parcelas' }
  }

  return { sucesso: true }
}

// ─── Utilitário ──────────────────────────────────────────────────────────────

interface LancamentoEnriquecerRow {
  id: string
  descricao: string
  tipo: 'receita' | 'despesa'
  paciente_id: string | null
  atendimento_id: string | null
}

async function enriquecerParcelas(
  parcelas: ParcelaRow[],
  clinicaId: string
): Promise<ParcelaComLancamento[]> {
  if (parcelas.length === 0) return []
  const supabase = createClient()

  const lancIds = [...new Set(parcelas.map((p) => p.lancamento_id))]

  const { data: lancamentosRaw } = await supabase
    .from('financeiro_lancamentos')
    .select('id, descricao, tipo, paciente_id, atendimento_id')
    .in('id', lancIds)

  const lancamentos = (lancamentosRaw ?? []) as unknown as LancamentoEnriquecerRow[]
  const lancMap: Record<string, LancamentoEnriquecerRow> = Object.fromEntries(
    lancamentos.map((l) => [l.id, l])
  )

  const pacienteIds = [
    ...new Set(
      lancamentos
        .map((l) => l.paciente_id)
        .filter((id): id is string => id !== null && id !== undefined)
    ),
  ]

  let pacienteMap: Record<string, string> = {}
  if (pacienteIds.length > 0) {
    const { data: pacientesRaw } = await supabase
      .from('pacientes')
      .select('id, nome')
      .in('id', pacienteIds)

    const pacientes = (pacientesRaw ?? []) as unknown as PacienteRow[]
    pacienteMap = Object.fromEntries(pacientes.map((p) => [p.id, p.nome]))
  }

  return parcelas.map((p) => {
    const lanc = lancMap[p.lancamento_id]
    return {
      ...p,
      lancamento: {
        id: lanc?.id ?? '',
        descricao: lanc?.descricao ?? '',
        tipo: lanc?.tipo ?? 'receita',
        paciente_id: lanc?.paciente_id ?? null,
        atendimento_id: lanc?.atendimento_id ?? null,
      },
      paciente_nome: lanc?.paciente_id ? (pacienteMap[lanc.paciente_id] ?? null) : null,
    }
  })
}