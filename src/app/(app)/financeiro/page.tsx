// src/app/(app)/financeiro/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, AlertTriangle, ChevronLeft, ChevronRight, Check, Clock, X, TrendingUp, Percent, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { useFinanceiro, baixarParcela } from '@/lib/hooks/useFinanceiro'
import { useComissaoStore } from '@/store/comissao.store'
import { FinanceiroPainel } from '@/components/financeiro/FinanceiroPainel'
import { ParcelaItem } from '@/components/financeiro/ParcelaItem'
import { formatarMoeda, formatarData, iniciais } from '@/lib/utils'

type Aba = 'visao_geral' | 'recebimentos' | 'orcamentos' | 'comissao'

// Dentistas fixos — identificados pelo prefixo [key] gravado na descrição dos avulsos
const DENTISTAS_CLINICA = [
  { key: 'rosiele', nome: 'Drª Rosiele Hoffmann',   initials: 'RH', cor: 'bg-purple-100 text-purple-700' },
  { key: 'eduardo', nome: 'Drº Eduardo Cortelleti', initials: 'EC', cor: 'bg-blue-100 text-blue-700'     },
]

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function nomeMes(mes: string) {
  const [ano, m] = mes.split('-')
  return `${MESES_PT[Number(m) - 1]} ${ano}`
}

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface ParcelaRow {
  id: string
  lancamento_id: string
  numero: number
  valor: number
  valor_pago: number | null
  data_pagamento: string | null
}

interface LancamentoRow {
  id: string
  descricao: string
  paciente_id: string | null
  tipo: string
  num_parcelas: number
}

interface PacienteRow {
  id: string
  nome: string
}

interface OrcamentoRow {
  id: string
  paciente_id: string
  status: 'pendente' | 'aprovado' | 'recusado'
  created_at: string
}

interface OrcamentoItemRow {
  orcamento_id: string
  procedimento_nome: string
  valor: number
}

// ── Recebimentos ──────────────────────────────────────────────────────────────

interface Recebimento {
  id: string
  paciente_nome: string | null
  descricao: string
  valor_pago: number
  data_pagamento: string | null
  num_parcela: number
  num_total_parcelas: number
}

function useRecebimentos(clinicaId: string, mes: string) {
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)

    const [ano, mesNum] = mes.split('-').map(Number)
    const inicio = `${mes}-01`
    const fim    = new Date(ano, mesNum, 0).toISOString().split('T')[0]

    const { data: parcelas } = await supabase
      .from('financeiro_parcelas')
      .select('id, lancamento_id, numero, valor, valor_pago, data_pagamento')
      .eq('clinica_id', clinicaId)
      .eq('status', 'pago')
      .gte('data_pagamento', inicio)
      .lte('data_pagamento', fim)
      .order('data_pagamento', { ascending: false })

    if (!parcelas?.length) {
      setRecebimentos([]); setTotal(0); setCarregando(false); return
    }

    const lancIds = [...new Set((parcelas as ParcelaRow[]).map((p) => p.lancamento_id))]
    const { data: lancs } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, paciente_id, tipo, num_parcelas')
      .in('id', lancIds)

    const pacIds = [...new Set(
      ((lancs ?? []) as LancamentoRow[]).map((l) => l.paciente_id).filter((id): id is string => id !== null)
    )]
    const { data: pacs } = pacIds.length
      ? await supabase.from('pacientes').select('id, nome').in('id', pacIds)
      : { data: [] as PacienteRow[] }

    const lancMap: Record<string, LancamentoRow> = Object.fromEntries(((lancs ?? []) as LancamentoRow[]).map((l) => [l.id, l]))
    const pacMap: Record<string, string> = Object.fromEntries(((pacs ?? []) as PacienteRow[]).map((p) => [p.id, p.nome]))

    const resultado: Recebimento[] = (parcelas as ParcelaRow[])
      .filter((p) => lancMap[p.lancamento_id]?.tipo === 'receita')
      .map((p) => {
        const lanc = lancMap[p.lancamento_id]
        return {
          id: p.id,
          paciente_nome: lanc?.paciente_id ? (pacMap[lanc.paciente_id] ?? null) : null,
          descricao: lanc?.descricao ?? '—',
          valor_pago: p.valor_pago ?? p.valor,
          data_pagamento: p.data_pagamento,
          num_parcela: p.numero,
          num_total_parcelas: lanc?.num_parcelas ?? 1,
        }
      })

    setRecebimentos(resultado)
    setTotal(resultado.reduce((s, r) => s + r.valor_pago, 0))
    setCarregando(false)
  }, [clinicaId, mes])

  useEffect(() => { carregar() }, [carregar])
  return { recebimentos, total, carregando, recarregar: carregar }
}

// ── Orçamentos com saldo ──────────────────────────────────────────────────────

interface OrcamentoFinanceiro {
  id: string
  paciente_id: string
  paciente_nome: string
  status: 'pendente' | 'aprovado' | 'recusado'
  valor_total: number
  valor_pago: number
  valor_pendente: number
  created_at: string
  itens: string[]   // nomes dos procedimentos
}

function extrairOrcId(descricao: string): string | null {
  const match = descricao.match(/^\[orc:([a-f0-9-]{36})\]/)
  return match ? match[1] : null
}

function useOrcamentosFinanceiro(clinicaId: string) {
  const [orcamentos, setOrcamentos] = useState<OrcamentoFinanceiro[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)

    const { data: orcs } = await supabase
      .from('orcamentos')
      .select('id, paciente_id, status, created_at')
      .eq('clinica_id', clinicaId)
      .in('status', ['pendente', 'aprovado'])
      .order('created_at', { ascending: false })

    if (!orcs?.length) { setOrcamentos([]); setCarregando(false); return }

    const orcIds = (orcs as OrcamentoRow[]).map((o) => o.id)
    const pacIds = [...new Set((orcs as OrcamentoRow[]).map((o) => o.paciente_id))]

    const [{ data: itensRaw }, { data: pacsRaw }, { data: lancsRaw }] = await Promise.all([
      supabase.from('orcamento_itens').select('orcamento_id, procedimento_nome, valor').in('orcamento_id', orcIds),
      supabase.from('pacientes').select('id, nome').in('id', pacIds),
      supabase.from('financeiro_lancamentos')
        .select('id, descricao')
        .eq('clinica_id', clinicaId)
        .eq('tipo', 'receita')
        .in('paciente_id', pacIds),
    ])

    const pacMap: Record<string, string> = Object.fromEntries(((pacsRaw ?? []) as PacienteRow[]).map((p) => [p.id, p.nome]))

    // Montar mapa orc_id → lançamento_id (via prefixo na descrição)
    const lancPorOrc: Record<string, string> = {}
    for (const lanc of (lancsRaw ?? []) as { id: string; descricao: string }[]) {
      const orcId = extrairOrcId(lanc.descricao)
      if (orcId) lancPorOrc[orcId] = lanc.id
    }

    // Buscar valor pago por lançamento
    const lancIds = Object.values(lancPorOrc)
    const pagoPorLanc: Record<string, number> = {}
    if (lancIds.length > 0) {
      const { data: parcelasRaw } = await supabase
        .from('financeiro_parcelas')
        .select('lancamento_id, valor_pago, status')
        .in('lancamento_id', lancIds)
        .in('status', ['pago', 'pago_parcial'])
      for (const p of (parcelasRaw ?? []) as { lancamento_id: string; valor_pago: number | null; status: string }[]) {
        pagoPorLanc[p.lancamento_id] = (pagoPorLanc[p.lancamento_id] ?? 0) + (p.valor_pago ?? 0)
      }
    }

    // Montar estrutura final
    const itensPorOrc: Record<string, { nome: string; valor: number }[]> = {}
    for (const item of (itensRaw ?? []) as OrcamentoItemRow[]) {
      if (!itensPorOrc[item.orcamento_id]) itensPorOrc[item.orcamento_id] = []
      itensPorOrc[item.orcamento_id].push({ nome: item.procedimento_nome, valor: Number(item.valor) })
    }

    const resultado: OrcamentoFinanceiro[] = (orcs as OrcamentoRow[]).map((o) => {
      const itens = itensPorOrc[o.id] ?? []
      const valorTotal = itens.reduce((s, i) => s + i.valor, 0)
      const lancId = lancPorOrc[o.id]
      const valorPago = lancId ? (pagoPorLanc[lancId] ?? 0) : 0
      return {
        id: o.id,
        paciente_id: o.paciente_id,
        paciente_nome: pacMap[o.paciente_id] ?? '—',
        status: o.status,
        valor_total: valorTotal,
        valor_pago: valorPago,
        valor_pendente: Math.max(0, valorTotal - valorPago),
        created_at: o.created_at,
        itens: itens.map((i) => i.nome),
      }
    })

    setOrcamentos(resultado)
    setCarregando(false)
  }, [clinicaId])

  useEffect(() => { carregar() }, [carregar])
  return { orcamentos, carregando, recarregar: carregar }
}

// ── Hook comissão por dentista ───────────────────────────────────────────────

interface RecebimentoPorDentista {
  dentistaKey: string
  dentistaNome: string
  totalRecebido: number
  numPagamentos: number
  pagamentos: Array<{
    id: string
    descricao: string
    paciente_nome: string | null
    valor: number
    data: string
  }>
}

function useComissaoDentista(clinicaId: string, mes: string) {
  const [porDentista, setPorDentista] = useState<RecebimentoPorDentista[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)

    const [ano, mesNum] = mes.split('-').map(Number)
    const inicio = `${mes}-01`
    const fim    = new Date(ano, mesNum, 0).toISOString().split('T')[0]

    // Buscar parcelas pagas do mês
    const { data: parcelasRaw } = await supabase
      .from('financeiro_parcelas')
      .select('id, lancamento_id, valor_pago, valor, data_pagamento')
      .eq('clinica_id', clinicaId)
      .eq('status', 'pago')
      .gte('data_pagamento', inicio)
      .lte('data_pagamento', fim)

    if (!parcelasRaw?.length) {
      setPorDentista(DENTISTAS_CLINICA.map(d => ({ dentistaKey: d.key, dentistaNome: d.nome, totalRecebido: 0, numPagamentos: 0, pagamentos: [] })))
      setCarregando(false)
      return
    }

    const parcelas = parcelasRaw as Array<{ id: string; lancamento_id: string; valor_pago: number | null; valor: number; data_pagamento: string }>
    const lancIds = [...new Set(parcelas.map(p => p.lancamento_id))]

    const { data: lancsRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, paciente_id, tipo')
      .in('id', lancIds)

    const lancs = (lancsRaw ?? []) as Array<{ id: string; descricao: string; paciente_id: string | null; tipo: string }>
    const lancMap: Record<string, typeof lancs[number]> = Object.fromEntries(lancs.map(l => [l.id, l]))

    // Buscar nomes dos pacientes
    const pacIds = [...new Set(lancs.map(l => l.paciente_id).filter((id): id is string => id !== null))]
    const pacMap: Record<string, string> = {}
    if (pacIds.length > 0) {
      const { data: pacs } = await supabase.from('pacientes').select('id, nome').in('id', pacIds)
      ;(pacs ?? []).forEach((p: { id: string; nome: string }) => { pacMap[p.id] = p.nome })
    }

    // Separar por dentista pelo prefixo [key] na descrição
    const grupos: Record<string, RecebimentoPorDentista> = {}
    DENTISTAS_CLINICA.forEach(d => {
      grupos[d.key] = { dentistaKey: d.key, dentistaNome: d.nome, totalRecebido: 0, numPagamentos: 0, pagamentos: [] }
    })

    for (const p of parcelas) {
      const lanc = lancMap[p.lancamento_id]
      if (!lanc || lanc.tipo !== 'receita') continue

      // Identificar dentista pelo tag [key] em qualquer posição da descrição
      // Formato avulso:    [eduardo] Manutenção
      // Formato orçamento: [orc:UUID][eduardo] Proc1, Proc2
      let dentistaKey = 'rosiele' // padrão
      const allTags = [...lanc.descricao.matchAll(/\[([a-z]+)\]/g)]
      for (const m of allTags) {
        if (grupos[m[1]]) { dentistaKey = m[1]; break }
      }

      const valor = p.valor_pago ?? p.valor
      grupos[dentistaKey].totalRecebido += valor
      grupos[dentistaKey].numPagamentos += 1
      grupos[dentistaKey].pagamentos.push({
        id: p.id,
        descricao: lanc.descricao.replace(/\[orc:[a-f0-9-]{36}\]/g, '').replace(/\[[a-z]+\]/g, '').trim(),
        paciente_nome: lanc.paciente_id ? (pacMap[lanc.paciente_id] ?? null) : null,
        valor,
        data: p.data_pagamento,
      })
    }

    setPorDentista(Object.values(grupos))
    setCarregando(false)
  }, [clinicaId, mes])

  useEffect(() => { carregar() }, [carregar])
  return { porDentista, carregando, recarregar: carregar }
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const { clinicaId } = useAuthStore()
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('visao_geral')
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [filtroOrc, setFiltroOrc] = useState<'todos' | 'pendente' | 'aprovado'>('todos')
  const [mesCom, setMesCom] = useState(new Date().toISOString().slice(0, 7))

  const { metricas, proximosVencimentos, carregando, recarregar } = useFinanceiro(clinicaId ?? '', mes)
  const { recebimentos, total: totalRecebido, carregando: carregandoRec } = useRecebimentos(clinicaId ?? '', mes)
  const { orcamentos, carregando: carregandoOrc } = useOrcamentosFinanceiro(clinicaId ?? '')
  const { percentualRosiele, percentualPatricia } = useComissaoStore()
  const { porDentista, carregando: carregandoCom } = useComissaoDentista(clinicaId ?? '', mesCom)

  function navMes(dir: -1 | 1) {
    const [ano, m] = mes.split('-').map(Number)
    const d = new Date(ano, m - 1 + dir)
    const novo = d.toISOString().slice(0, 7)
    if (dir === 1 && novo > new Date().toISOString().slice(0, 7)) return
    setMes(novo)
  }

  async function handleBaixar(parcelaId: string) {
    if (await baixarParcela(parcelaId)) recarregar()
  }

  const abas: { id: Aba; label: string }[] = [
    { id: 'visao_geral',  label: 'Geral'       },
    { id: 'recebimentos', label: 'Recebidos'   },
    { id: 'orcamentos',   label: 'Orçamentos'  },
    { id: 'comissao',     label: 'Comissão'    },
  ]

  // ── Métricas dos orçamentos ────────────────────────────────────────────────
  const pendentes = orcamentos.filter((o) => o.status === 'pendente')
  const aprovados  = orcamentos.filter((o) => o.status === 'aprovado')
  const totalPendente  = pendentes.reduce((s, o) => s + o.valor_total, 0)
  const totalAprovado  = aprovados.reduce((s, o) => s + o.valor_total, 0)
  const totalPagoOrc   = aprovados.reduce((s, o) => s + o.valor_pago, 0)
  const totalFaltaOrc  = aprovados.reduce((s, o) => s + o.valor_pendente, 0)

  const orcamentosFiltrados = filtroOrc === 'todos'
    ? orcamentos
    : orcamentos.filter((o) => o.status === filtroOrc)

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Financeiro</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/financeiro/avulso"
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-sm font-medium text-white active:bg-emerald-700"
            >
              <Zap className="h-4 w-4" /> Avulso
            </Link>
            <Link
              href="/financeiro/lancamento"
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-2 text-sm font-medium text-white active:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Lançar
            </Link>
          </div>
        </div>
        <div className="flex border-b border-gray-200">
          {abas.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                aba === a.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 space-y-4">

        {/* ── Visão Geral ── */}
        {aba === 'visao_geral' && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={() => navMes(-1)} className="p-2 rounded-xl active:bg-gray-100">
                <ChevronLeft className="h-5 w-5 text-gray-500" />
              </button>
              <span className="text-sm font-semibold text-gray-700">{nomeMes(mes)}</span>
              <button
                onClick={() => navMes(1)}
                disabled={mes >= new Date().toISOString().slice(0, 7)}
                className="p-2 rounded-xl active:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <FinanceiroPainel
              metricas={metricas}
              carregando={carregando}
              mes={mes}
              onMesAnterior={() => navMes(-1)}
              onMesProximo={() => navMes(1)}
            />

            <Link
              href="/financeiro/inadimplentes"
              className="flex items-center justify-between bg-red-50 border border-red-100 rounded-2xl px-4 py-4 active:bg-red-100"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-red-700 text-sm">Inadimplentes</p>
                  <p className="text-xs text-red-400">Ver parcelas vencidas</p>
                </div>
              </div>
              <span className="text-red-400 text-lg">›</span>
            </Link>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Próximos 7 dias</h2>
                <Link href="/financeiro/parcelas" className="text-xs text-blue-600 font-medium">
                  Ver tudo →
                </Link>
              </div>
              {carregando ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse mb-2" />
                ))
              ) : proximosVencimentos.length === 0 ? (
                <div className="bg-white rounded-xl px-4 py-6 shadow-sm text-center">
                  <p className="text-sm text-gray-400">Nenhum vencimento nos próximos 7 dias</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {proximosVencimentos.map((p) => (
                    <ParcelaItem
                      key={p.id}
                      parcela={p}
                      mostrarPaciente
                      onBaixar={handleBaixar}
                      onClick={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Recebimentos ── */}
        {aba === 'recebimentos' && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={() => navMes(-1)} className="p-2 rounded-xl active:bg-gray-100">
                <ChevronLeft className="h-5 w-5 text-gray-500" />
              </button>
              <span className="text-sm font-semibold text-gray-700">{nomeMes(mes)}</span>
              <button
                onClick={() => navMes(1)}
                disabled={mes >= new Date().toISOString().slice(0, 7)}
                className="p-2 rounded-xl active:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-green-50 rounded-2xl px-4 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Total recebido em {nomeMes(mes)}</p>
                <p className="text-2xl font-bold text-green-700 mt-0.5">{formatarMoeda(totalRecebido)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>

            {carregandoRec ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))
            ) : recebimentos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">💰</div>
                <p className="font-medium text-gray-500">Nenhum pagamento recebido</p>
                <p className="text-sm text-gray-400 mt-1">em {nomeMes(mes)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recebimentos.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {r.paciente_nome && (
                          <p className="text-sm font-semibold text-gray-900 truncate">{r.paciente_nome}</p>
                        )}
                        <p className="text-xs text-gray-500 truncate">
                          {r.descricao}
                          {r.num_total_parcelas > 1 && (
                            <span className="ml-1 text-gray-400">({r.num_parcela}/{r.num_total_parcelas})</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.data_pagamento ? formatarData(r.data_pagamento) : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-sm font-bold text-green-700">{formatarMoeda(r.valor_pago)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Orçamentos — Dashboard ── */}
        {aba === 'orcamentos' && (
          <>
            {/* Cards de métricas */}
            {!carregandoOrc && (
              <div className="space-y-3">

                {/* Linha 1: Aprovados — resumo financeiro */}
                {aprovados.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* Cabeçalho */}
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                      <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="text-sm font-bold text-gray-800">
                        {aprovados.length} orçamento{aprovados.length !== 1 ? 's' : ''} aprovado{aprovados.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {/* 3 métricas */}
                    <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Total</p>
                        <p className="text-sm font-bold text-gray-900">{formatarMoeda(totalAprovado)}</p>
                      </div>
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Recebido</p>
                        <p className="text-sm font-bold text-emerald-600">{formatarMoeda(totalPagoOrc)}</p>
                      </div>
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">A receber</p>
                        <p className={`text-sm font-bold ${totalFaltaOrc > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {formatarMoeda(totalFaltaOrc)}
                        </p>
                      </div>
                    </div>

                    {/* Barra de progresso geral */}
                    {totalAprovado > 0 && (
                      <div className="px-4 pb-4 pt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Progresso de recebimento</span>
                          <span>{Math.round((totalPagoOrc / totalAprovado) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (totalPagoOrc / totalAprovado) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Card pendentes */}
                {pendentes.length > 0 && (
                  <div className="bg-amber-50 rounded-2xl px-4 py-3 flex items-center justify-between border border-amber-100">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-800">
                          {pendentes.length} aguardando aprovação
                        </p>
                        <p className="text-xs text-amber-600">Valor estimado</p>
                      </div>
                    </div>
                    <p className="text-base font-bold text-amber-700">{formatarMoeda(totalPendente)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Filtro */}
            <div className="flex gap-2">
              {([
                { id: 'todos',    label: 'Todos'    },
                { id: 'aprovado', label: 'Aprovados' },
                { id: 'pendente', label: 'Pendentes' },
              ] as { id: typeof filtroOrc; label: string }[]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroOrc(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    filtroOrc === f.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  {f.label}
                  <span className="ml-1 opacity-60">
                    ({f.id === 'todos' ? orcamentos.length : f.id === 'aprovado' ? aprovados.length : pendentes.length})
                  </span>
                </button>
              ))}
            </div>

            {/* Lista de orçamentos */}
            {carregandoOrc ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
              ))
            ) : orcamentosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="font-medium text-gray-500">Nenhum orçamento encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orcamentosFiltrados.map((o) => {
                  const isAprovado = o.status === 'aprovado'
                  const pct = o.valor_total > 0
                    ? Math.min(100, Math.round((o.valor_pago / o.valor_total) * 100))
                    : 0
                  const quitado = o.valor_pendente <= 0.01 && isAprovado

                  return (
                    <button
                      key={o.id}
                      onClick={() => router.push(`/pacientes/${o.paciente_id}`)}
                      className="w-full bg-white rounded-2xl shadow-sm text-left active:scale-[0.99] transition-transform overflow-hidden"
                    >
                      {/* Topo do card */}
                      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                        {/* Avatar */}
                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isAprovado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {iniciais(o.paciente_nome)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{o.paciente_nome}</p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                {o.itens.slice(0, 2).join(', ')}
                                {o.itens.length > 2 && ` +${o.itens.length - 2}`}
                              </p>
                              <p className="text-xs text-gray-300 mt-0.5">{formatarData(o.created_at.split('T')[0])}</p>
                            </div>
                            {/* Badge status */}
                            <span className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              quitado
                                ? 'bg-blue-50 text-blue-600'
                                : isAprovado
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                            }`}>
                              {quitado ? (
                                <><Check className="h-3 w-3" /> Quitado</>
                              ) : isAprovado ? (
                                <><Check className="h-3 w-3" /> Aprovado</>
                              ) : (
                                <><Clock className="h-3 w-3" /> Pendente</>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Linha divisória */}
                      <div className="border-t border-gray-50 mx-4" />

                      {/* Valores */}
                      <div className="grid grid-cols-3 divide-x divide-gray-100 px-0">
                        <div className="px-4 py-2.5 text-center">
                          <p className="text-xs text-gray-400">Total</p>
                          <p className="text-sm font-bold text-gray-800 mt-0.5">{formatarMoeda(o.valor_total)}</p>
                        </div>
                        <div className="px-4 py-2.5 text-center">
                          <p className="text-xs text-gray-400">Pago</p>
                          <p className="text-sm font-bold text-emerald-600 mt-0.5">
                            {isAprovado ? formatarMoeda(o.valor_pago) : '—'}
                          </p>
                        </div>
                        <div className="px-4 py-2.5 text-center">
                          <p className="text-xs text-gray-400">Falta</p>
                          <p className={`text-sm font-bold mt-0.5 ${
                            !isAprovado ? 'text-gray-300' : o.valor_pendente > 0 ? 'text-red-500' : 'text-emerald-600'
                          }`}>
                            {isAprovado ? formatarMoeda(o.valor_pendente) : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Barra de progresso — só aprovados */}
                      {isAprovado && (
                        <div className="px-4 pb-3 pt-1">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${quitado ? 'bg-blue-400' : 'bg-emerald-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {!quitado && o.valor_pago > 0 && (
                            <p className="text-xs text-gray-400 mt-1">{pct}% recebido</p>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── Comissão ── */}
        {aba === 'comissao' && (
          <>
            <div className="flex items-center justify-between">
              <button onClick={() => {
                const [ano, m] = mesCom.split('-').map(Number)
                setMesCom(new Date(ano, m - 2).toISOString().slice(0, 7))
              }} className="p-2 rounded-xl active:bg-gray-100">
                <ChevronLeft className="h-5 w-5 text-gray-500" />
              </button>
              <span className="text-sm font-semibold text-gray-700">{nomeMes(mesCom)}</span>
              <button
                onClick={() => {
                  const [ano, m] = mesCom.split('-').map(Number)
                  const novo = new Date(ano, m).toISOString().slice(0, 7)
                  if (novo <= new Date().toISOString().slice(0, 7)) setMesCom(novo)
                }}
                disabled={mesCom >= new Date().toISOString().slice(0, 7)}
                className="p-2 rounded-xl active:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-gray-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Rosiele recebe <strong>{percentualRosiele}%</strong> · Patricia recebe <strong>{percentualPatricia}%</strong> do bruto do Dr. Eduardo
              </p>
              <Link href="/configuracoes/comissao" className="text-xs text-blue-600 font-semibold flex-shrink-0 ml-2">Editar</Link>
            </div>

            {carregandoCom ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (() => {
              const rosiele = porDentista.find(d => d.dentistaKey === 'rosiele')
              const eduardo = porDentista.find(d => d.dentistaKey === 'eduardo')
              const eduardoTotal     = eduardo?.totalRecebido ?? 0
              const paraRosiele      = eduardoTotal * percentualRosiele / 100
              const paraPatricia     = eduardoTotal * percentualPatricia / 100
              const roseileTotal     = (rosiele?.totalRecebido ?? 0) + paraRosiele
              const eduardoLiquido   = eduardoTotal - paraRosiele - paraPatricia
              return (
                <div className="space-y-3">
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">EC</div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">Drº Eduardo Cortelleti</p>
                        <p className="text-xs text-gray-400">{eduardo?.numPagamentos ?? 0} pagamento{(eduardo?.numPagamentos ?? 0) !== 1 ? 's' : ''} em {nomeMes(mesCom)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-gray-400">Bruto</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">{formatarMoeda(eduardoTotal)}</p>
                      </div>
                      <div className="px-3 py-3 text-center bg-purple-50">
                        <p className="text-xs text-purple-500">Para Rosiele ({percentualRosiele}%)</p>
                        <p className="text-sm font-bold text-purple-700 mt-0.5">{formatarMoeda(paraRosiele)}</p>
                      </div>
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-gray-400">Líquido</p>
                        <p className="text-sm font-bold text-blue-700 mt-0.5">{formatarMoeda(eduardoLiquido)}</p>
                      </div>
                    </div>
                    {(eduardo?.pagamentos.length ?? 0) > 0 && (
                      <div className="border-t border-gray-50">
                        {eduardo!.pagamentos.slice(0, 4).map((p, i) => (
                          <div key={p.id} className={`flex items-center justify-between px-4 py-2.5 ${i < eduardo!.pagamentos.length - 1 ? 'border-b border-gray-50' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{p.paciente_nome ?? p.descricao}</p>
                              <p className="text-xs text-gray-400">{formatarData(p.data)}</p>
                            </div>
                            <p className="text-xs font-bold text-gray-700 ml-3 flex-shrink-0">{formatarMoeda(p.valor)}</p>
                          </div>
                        ))}
                        {(eduardo?.pagamentos.length ?? 0) > 4 && (
                          <p className="text-center text-xs text-gray-400 py-2">+{(eduardo?.pagamentos.length ?? 0) - 4} mais</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                      <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700 flex-shrink-0">RH</div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">Drª Rosiele Hoffmann</p>
                        <p className="text-xs text-gray-400">Produção própria + repasse líquido do Dr. Eduardo</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-gray-400">Próprio</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">{formatarMoeda(rosiele?.totalRecebido ?? 0)}</p>
                      </div>
                      <div className="px-3 py-3 text-center bg-blue-50">
                        <p className="text-xs text-blue-500">+ Do Dr. Eduardo</p>
                        <p className="text-sm font-bold text-blue-700 mt-0.5">+{formatarMoeda(paraRosiele)}</p>
                      </div>
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-purple-600 font-semibold">Total</p>
                        <p className="text-sm font-bold text-purple-700 mt-0.5">{formatarMoeda(roseileTotal)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-600 rounded-2xl overflow-hidden">
                    <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">P</div>
                      <div>
                        <p className="font-bold text-white text-sm">Patricia — Comissão do mês</p>
                        <p className="text-xs text-emerald-200">{percentualPatricia}% sobre o bruto do Dr. Eduardo</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-emerald-500 border-t border-emerald-500">
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-emerald-200">Base (bruto)</p>
                        <p className="text-sm font-bold text-white mt-0.5">{formatarMoeda(eduardoTotal)}</p>
                      </div>
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-emerald-200">Percentual</p>
                        <p className="text-sm font-bold text-white mt-0.5">{percentualPatricia}%</p>
                      </div>
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-emerald-200 font-semibold">A receber</p>
                        <p className="text-xl font-bold text-white mt-0.5">{formatarMoeda(paraPatricia)}</p>
                      </div>
                    </div>
                    {eduardoTotal > 0 && (
                      <div className="px-4 py-2 bg-emerald-700">
                        <p className="text-xs text-emerald-300 text-center">
                          {percentualPatricia}% direto do bruto do Dr. Eduardo ({formatarMoeda(eduardoTotal)})
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </>
        )}

      </div>
    </div>
  )
}
