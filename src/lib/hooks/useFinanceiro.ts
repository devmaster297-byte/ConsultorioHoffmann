// src/lib/hooks/useFinanceiro.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-browser'
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
  status: 'pendente' | 'pago' | 'pago_parcial' | 'vencido'
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
  status: 'pendente' | 'pago' | 'pago_parcial' | 'vencido'
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

// ─── Utilitário: atualizar status vencido no banco ────────────────────────────
// Roda client-side antes de calcular métricas.
// FIX: usa data local (não UTC) para evitar marcar parcelas de hoje como vencidas
// em fusos GMT-3 após 21h.

async function atualizarParcelasVencidas(clinicaId: string): Promise<void> {
  const agora = new Date()
  const hoje = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0]

  await supabase
    .from('financeiro_parcelas')
    .update({ status: 'vencido' })
    .eq('clinica_id', clinicaId)
    .in('status', ['pendente', 'pago_parcial'])
    .lt('data_vencimento', hoje)
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

    await atualizarParcelasVencidas(clinicaId)

    const { data: lancamentosRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, tipo, descricao, valor_total, paciente_id, atendimento_id')
      .eq('clinica_id', clinicaId)

    const lancamentos = (lancamentosRaw ?? []) as unknown as LancamentoRow[]
    const lancIds = lancamentos.map((l) => l.id)
    const lancMap: Record<string, LancamentoRow> = Object.fromEntries(
      lancamentos.map((l) => [l.id, l])
    )

    if (lancIds.length === 0) {
      setMetricas({ totalRecebido: 0, totalPendente: 0, totalDespesas: 0, saldo: 0 })
      setProximosVencimentos([])
      setCarregando(false)
      return
    }

    // ── RECEITA: filtrar por data de PAGAMENTO ────────────────────────────────
    const { data: receitaRaw } = await supabase
      .from('financeiro_parcelas')
      .select('*')
      .eq('clinica_id', clinicaId)
      .in('lancamento_id', lancIds)
      .in('status', ['pago', 'pago_parcial'])
      .gte('data_pagamento', inicioMes)
      .lte('data_pagamento', fimMes)

    const parcelasReceita = (receitaRaw ?? []) as unknown as ParcelaRow[]

    let totalRecebido = 0
    for (const p of parcelasReceita) {
      const lanc = lancMap[p.lancamento_id]
      if (!lanc || lanc.tipo !== 'receita') continue
      totalRecebido += p.valor_pago ?? p.valor
    }

    // ── PENDENTE: filtrar por VENCIMENTO no mês ──────────────────────────────
    const { data: pendentesRaw } = await supabase
      .from('financeiro_parcelas')
      .select('*')
      .eq('clinica_id', clinicaId)
      .in('lancamento_id', lancIds)
      .in('status', ['pendente', 'vencido'])
      .gte('data_vencimento', inicioMes)
      .lte('data_vencimento', fimMes)

    const parcelasPendentes = (pendentesRaw ?? []) as unknown as ParcelaRow[]

    let totalPendente = 0
    for (const p of parcelasPendentes) {
      const lanc = lancMap[p.lancamento_id]
      if (!lanc || lanc.tipo !== 'receita') continue
      // FIX: saldo real = valor - já pago (para pago_parcial)
      totalPendente += p.valor - (p.valor_pago ?? 0)
    }

    // ── DESPESA: filtrar por data de PAGAMENTO ────────────────────────────────
    const { data: despesaRaw } = await supabase
      .from('financeiro_parcelas')
      .select('*')
      .eq('clinica_id', clinicaId)
      .in('lancamento_id', lancIds)
      .in('status', ['pago', 'pago_parcial'])
      .gte('data_pagamento', inicioMes)
      .lte('data_pagamento', fimMes)

    const parcelasDespesa = (despesaRaw ?? []) as unknown as ParcelaRow[]

    let totalDespesas = 0
    for (const p of parcelasDespesa) {
      const lanc = lancMap[p.lancamento_id]
      if (!lanc || lanc.tipo !== 'despesa') continue
      totalDespesas += p.valor_pago ?? p.valor
    }

    setMetricas({
      totalRecebido,
      totalPendente,
      totalDespesas,
      saldo: totalRecebido - totalDespesas,
    })

    // ── PRÓXIMOS VENCIMENTOS (7 dias) ─────────────────────────────────────────
    const agora = new Date()
    const hojeStr = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
      .toISOString().split('T')[0]
    const em7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data: proxVencRaw } = await supabase
      .from('financeiro_parcelas')
      .select('*')
      .eq('clinica_id', clinicaId)
      .in('lancamento_id', lancIds)
      .in('status', ['pendente', 'pago_parcial'])
      .gte('data_vencimento', hojeStr)
      .lte('data_vencimento', em7Dias)
      .order('data_vencimento')
      .limit(10)

    const proxVenc = (proxVencRaw ?? []) as unknown as ParcelaRow[]
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

    await atualizarParcelasVencidas(clinicaId)

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

    const grupos: Record<string, Inadimplente> = {}
    for (const p of parcelasComNome) {
      const pacId = p.lancamento.paciente_id
      if (!pacId) continue

      if (!grupos[pacId]) {
        grupos[pacId] = {
          paciente_id: pacId,
          paciente_nome: p.paciente_nome ?? 'Paciente',
          total_vencido: 0,
          parcelas: [],
        }
      }

      // FIX: saldo real = valor - já pago (nunca negativo)
      const saldoParcela = Math.max(0, p.valor - (p.valor_pago ?? 0))
      grupos[pacId].total_vencido += saldoParcela
      grupos[pacId].parcelas.push(p)
    }

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
  valor_pago: number | null
}

export async function baixarParcela(
  parcelaId: string,
  valorPago?: number
): Promise<boolean> {
  const agora = new Date()
  const hoje = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0]

  const { data: parcelaRaw } = await supabase
    .from('financeiro_parcelas')
    .select('valor, valor_pago')
    .eq('id', parcelaId)
    .single()

  const parcela = parcelaRaw as unknown as { valor: number; valor_pago: number | null } | null
  if (!parcela) return false

  // FIX: acumular pagamentos parciais anteriores
  const jaFoiPago = parcela.valor_pago ?? 0
  const novoPagamento = valorPago ?? parcela.valor
  const totalPago = jaFoiPago + novoPagamento
  const status = totalPago >= parcela.valor ? 'pago' : 'pago_parcial'

  const { error } = await supabase
    .from('financeiro_parcelas')
    .update({
      status,
      valor_pago: Number(Math.min(totalPago, parcela.valor).toFixed(2)),
      data_pagamento: hoje,
    })
    .eq('id', parcelaId)

  return !error
}

export async function baixarParcelasEmLote(parcelaIds: string[]): Promise<boolean> {
  const agora = new Date()
  const hoje = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0]

  // FIX: buscar valor_pago atual para acumular pagamentos parciais
  const { data: parcelasRaw } = await supabase
    .from('financeiro_parcelas')
    .select('id, valor, valor_pago')
    .in('id', parcelaIds)

  const parcelas = (parcelasRaw ?? []) as unknown as ParcelaValorRow[]
  if (parcelas.length === 0) return false

  const resultados = await Promise.all(
    parcelas.map((p) => {
      const jaFoiPago = p.valor_pago ?? 0
      const totalPago = Math.min(jaFoiPago + p.valor, p.valor)
      return supabase
        .from('financeiro_parcelas')
        .update({
          status: 'pago',
          valor_pago: Number(totalPago.toFixed(2)),
          data_pagamento: hoje,
        })
        .eq('id', p.id)
    })
  )

  return resultados.every((r) => !r.error)
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

  const { data: lancamentoRaw, error: lancErr } = await supabase
    .from('financeiro_lancamentos')
    .insert({
      clinica_id: input.clinicaId,
      paciente_id: input.pacienteId ?? null,
      atendimento_id: input.atendimentoId ?? null,
      orcamento_id: input.orcamentoId ?? null,
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

  const valorParcela = Number((input.valorTotal / input.numParcelas).toFixed(2))

  const parcelas = Array.from({ length: input.numParcelas }, (_, i) => {
    // FIX: avançar meses corretamente sem usar setMonth direto.
    // Parseamos ano/mês/dia do primeiroVencimento e somamos meses manualmente,
    // respeitando o último dia do mês destino.
    const [anoBase, mesBase, diaBase] = input.primeiroVencimento.split('-').map(Number)
    const mesDestino = mesBase - 1 + i         // mês 0-indexed
    const anoDestino = anoBase + Math.floor(mesDestino / 12)
    const mesNorm    = (mesDestino % 12) + 1   // volta para 1-indexed

    // Último dia do mês destino
    const ultimoDia = new Date(anoDestino, mesNorm, 0).getDate()
    const diaFinal  = Math.min(diaBase, ultimoDia)

    const venc = `${anoDestino}-${String(mesNorm).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`

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
      data_vencimento: venc,
      status: 'pendente' as const,
    }
  })

  const { error: parcErr } = await supabase
    .from('financeiro_parcelas')
    .insert(parcelas)

  if (parcErr) {
    await supabase.from('financeiro_lancamentos').delete().eq('id', lancamento.id)
    return { sucesso: false, erro: 'Erro ao criar parcelas' }
  }

  return { sucesso: true }
}

// ─── Utilitário: enriquecer parcelas com dados do lançamento e paciente ───────

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
