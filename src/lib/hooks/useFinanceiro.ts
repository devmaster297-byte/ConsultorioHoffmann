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
  status: 'pendente' | 'pago' | 'pago_parcial' | 'vencido' | 'cancelado'
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

// ─── Utilitário: atualizar status vencido no banco ───────────────────────────
// Problema 3: o status 'vencido' nunca era atualizado automaticamente.
// Esta função corrige isso client-side antes de calcular as métricas,
// evitando a necessidade de um cron job ou trigger no banco.

async function atualizarParcelasVencidas(clinicaId: string): Promise<void> {
  const hoje = new Date().toISOString().split('T')[0]

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

    // FIX 3: Atualizar parcelas vencidas antes de calcular qualquer métrica
    await atualizarParcelasVencidas(clinicaId)

    // Buscar apenas IDs dos lançamentos da clínica
    const { data: lancamentosRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, tipo, descricao, valor_total, paciente_id, atendimento_id')
      .eq('clinica_id', clinicaId)

    const lancamentos = (lancamentosRaw ?? []) as unknown as LancamentoRow[]
    const lancIds = lancamentos.map((l) => l.id)
    const lancMap: Record<string, LancamentoRow> = Object.fromEntries(
      lancamentos.map((l) => [l.id, l])
    )

    // ── MÉTRICAS DE RECEITA ───────────────────────────────────────────────────
    // FIX 1: Filtrar por DATA DE PAGAMENTO (não por vencimento).
    // Receita só entra no mês em que o dinheiro entrou de fato.
    let parcelasReceita: ParcelaRow[] = []
    if (lancIds.length > 0) {
      const { data: receitaRaw } = await supabase
        .from('financeiro_parcelas')
        .select('*')
        .eq('clinica_id', clinicaId)
        .in('lancamento_id', lancIds)
        .in('status', ['pago', 'pago_parcial'])
        .gte('data_pagamento', inicioMes)
        .lte('data_pagamento', fimMes)

      parcelasReceita = (receitaRaw ?? []) as unknown as ParcelaRow[]
    }

    // FIX 5: Filtrar apenas parcelas de lançamentos do tipo 'receita'
    let totalRecebido = 0
    for (const p of parcelasReceita) {
      const lanc = lancMap[p.lancamento_id]
      if (!lanc || lanc.tipo !== 'receita') continue
      totalRecebido += p.valor_pago ?? p.valor
    }

    // ── MÉTRICAS DE PENDENTE (vencimento no mês, não pagas) ──────────────────
    // Pendente usa vencimento porque são valores ainda não pagos
    let parcelasPendentes: ParcelaRow[] = []
    if (lancIds.length > 0) {
      const { data: pendentesRaw } = await supabase
        .from('financeiro_parcelas')
        .select('*')
        .eq('clinica_id', clinicaId)
        .in('lancamento_id', lancIds)
        .in('status', ['pendente', 'vencido'])
        .gte('data_vencimento', inicioMes)
        .lte('data_vencimento', fimMes)

      parcelasPendentes = (pendentesRaw ?? []) as unknown as ParcelaRow[]
    }

    let totalPendente = 0
    for (const p of parcelasPendentes) {
      const lanc = lancMap[p.lancamento_id]
      if (!lanc || lanc.tipo !== 'receita') continue
      // FIX 4: usar saldo real (valor - já pago) para pago_parcial
      totalPendente += p.valor - (p.valor_pago ?? 0)
    }

    // ── MÉTRICAS DE DESPESA ───────────────────────────────────────────────────
    // FIX 1 + 2: Despesa filtrada por DATA DE PAGAMENTO e somente se paga.
    // Despesa pendente NÃO entra no fluxo de caixa do mês.
    let parcelasDespesa: ParcelaRow[] = []
    if (lancIds.length > 0) {
      const { data: despesaRaw } = await supabase
        .from('financeiro_parcelas')
        .select('*')
        .eq('clinica_id', clinicaId)
        .in('lancamento_id', lancIds)
        .in('status', ['pago', 'pago_parcial'])
        .gte('data_pagamento', inicioMes)
        .lte('data_pagamento', fimMes)

      parcelasDespesa = (despesaRaw ?? []) as unknown as ParcelaRow[]
    }

    let totalDespesas = 0
    for (const p of parcelasDespesa) {
      const lanc = lancMap[p.lancamento_id]
      // FIX 5: apenas lançamentos explicitamente do tipo 'despesa'
      if (!lanc || lanc.tipo !== 'despesa') continue
      // FIX 2: somente o valor efetivamente pago (nunca o valor nominal)
      totalDespesas += p.valor_pago ?? p.valor
    }

    setMetricas({
      totalRecebido,
      totalPendente,
      totalDespesas,
      saldo: totalRecebido - totalDespesas,
    })

    // ── PRÓXIMOS VENCIMENTOS (7 dias) ─────────────────────────────────────────
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

    // FIX 3: atualizar vencidos antes de listar inadimplentes
    await atualizarParcelasVencidas(clinicaId)

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

    // Parcelas pendentes, pago_parcial ou vencidas com saldo em aberto
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

      // FIX 4: saldo real = valor - valor já pago (nunca negativo)
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
  const hoje = new Date().toISOString().split('T')[0]

  const { data: parcelaRaw } = await supabase
    .from('financeiro_parcelas')
    .select('valor, valor_pago')
    .eq('id', parcelaId)
    .single()

  const parcela = parcelaRaw as unknown as { valor: number; valor_pago: number | null } | null
  if (!parcela) return false

  // FIX 4: acumular pagamentos parciais anteriores
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
  const hoje = new Date().toISOString().split('T')[0]

  const { data: parcelasRaw } = await supabase
    .from('financeiro_parcelas')
    .select('id, valor')
    .in('id', parcelaIds)

  const parcelas = (parcelasRaw ?? []) as unknown as ParcelaValorRow[]
  if (parcelas.length === 0) return false

  const resultados = await Promise.all(
    parcelas.map((p) =>
      supabase
        .from('financeiro_parcelas')
        .update({
          status: 'pago',
          valor_pago: p.valor,
          data_pagamento: hoje,
        })
        .eq('id', p.id)
    )
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
    // T12:00:00 evita bug de fuso horário que avança/recua um dia
    const dataVenc = new Date(input.primeiroVencimento + 'T12:00:00')
    dataVenc.setMonth(dataVenc.getMonth() + i)

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