// src/app/(app)/financeiro/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, AlertTriangle, ChevronLeft, ChevronRight, Check, Clock, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { useFinanceiro, baixarParcela } from '@/lib/hooks/useFinanceiro'
import { FinanceiroPainel } from '@/components/financeiro/FinanceiroPainel'
import { ParcelaItem } from '@/components/financeiro/ParcelaItem'
import { formatarMoeda, formatarData } from '@/lib/utils'

type Aba = 'visao_geral' | 'recebimentos' | 'orcamentos'

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function nomeMes(mes: string) {
  const [ano, m] = mes.split('-')
  return `${MESES_PT[Number(m) - 1]} ${ano}`
}

// ── Tipos internos de query ───────────────────────────────────────────────────
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
    const supabase = createClient()

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
      setRecebimentos([])
      setTotal(0)
      setCarregando(false)
      return
    }

    const lancIds = [...new Set((parcelas as ParcelaRow[]).map((p: ParcelaRow) => p.lancamento_id))]
    const { data: lancs } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, paciente_id, tipo, num_parcelas')
      .in('id', lancIds)

    const pacIds = [...new Set(
      ((lancs ?? []) as LancamentoRow[])
        .map((l: LancamentoRow) => l.paciente_id)
        .filter((id): id is string => id !== null)
    )]

    const { data: pacs } = pacIds.length
      ? await supabase.from('pacientes').select('id, nome').in('id', pacIds)
      : { data: [] as PacienteRow[] }

    const lancMap: Record<string, LancamentoRow> = Object.fromEntries(
      ((lancs ?? []) as LancamentoRow[]).map((l: LancamentoRow) => [l.id, l])
    )
    const pacMap: Record<string, string> = Object.fromEntries(
      ((pacs ?? []) as PacienteRow[]).map((p: PacienteRow) => [p.id, p.nome])
    )

    const resultado: Recebimento[] = (parcelas as ParcelaRow[])
      .filter((p: ParcelaRow) => lancMap[p.lancamento_id]?.tipo === 'receita')
      .map((p: ParcelaRow) => {
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
    setTotal(resultado.reduce((s: number, r: Recebimento) => s + r.valor_pago, 0))
    setCarregando(false)
  }, [clinicaId, mes])

  useEffect(() => { carregar() }, [carregar])
  return { recebimentos, total, carregando, recarregar: carregar }
}

// ── Orçamentos Financeiro ─────────────────────────────────────────────────────
interface OrcamentoFinanceiro {
  id: string
  paciente_id: string
  paciente_nome: string
  status: 'pendente' | 'aprovado' | 'recusado'
  valor_total: number
  created_at: string
  num_itens: number
}

function useOrcamentosFinanceiro(clinicaId: string) {
  const [orcamentos, setOrcamentos] = useState<OrcamentoFinanceiro[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)
    const supabase = createClient()

    const { data: orcs } = await supabase
      .from('orcamentos')
      .select('id, paciente_id, status, created_at')
      .eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false })

    if (!orcs?.length) { setOrcamentos([]); setCarregando(false); return }

    const { data: itens } = await supabase
      .from('orcamento_itens')
      .select('orcamento_id, valor')
      .in('orcamento_id', (orcs as OrcamentoRow[]).map((o: OrcamentoRow) => o.id))

    const pacIds = [...new Set((orcs as OrcamentoRow[]).map((o: OrcamentoRow) => o.paciente_id))]
    const { data: pacs } = await supabase
      .from('pacientes').select('id, nome').in('id', pacIds)

    const pacMap: Record<string, string> = Object.fromEntries(
      ((pacs ?? []) as PacienteRow[]).map((p: PacienteRow) => [p.id, p.nome])
    )
    const totalPorOrc: Record<string, number> = {}
    const itensPorOrc: Record<string, number> = {};
    ((itens ?? []) as OrcamentoItemRow[]).forEach((i: OrcamentoItemRow) => {
      totalPorOrc[i.orcamento_id] = (totalPorOrc[i.orcamento_id] ?? 0) + Number(i.valor)
      itensPorOrc[i.orcamento_id] = (itensPorOrc[i.orcamento_id] ?? 0) + 1
    })

    setOrcamentos((orcs as OrcamentoRow[]).map((o: OrcamentoRow) => ({
      id: o.id,
      paciente_id: o.paciente_id,
      paciente_nome: pacMap[o.paciente_id] ?? '—',
      status: o.status,
      valor_total: totalPorOrc[o.id] ?? 0,
      created_at: o.created_at,
      num_itens: itensPorOrc[o.id] ?? 0,
    })))
    setCarregando(false)
  }, [clinicaId])

  useEffect(() => { carregar() }, [carregar])
  return { orcamentos, carregando, recarregar: carregar }
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_ORC: Record<string, { label: string; bg: string; color: string; Icon: React.ElementType }> = {
  pendente: { label: 'Pendente', bg: '#FEF9C3', color: '#854D0E', Icon: Clock  },
  aprovado: { label: 'Aprovado', bg: '#DCFCE7', color: '#166534', Icon: Check  },
  recusado: { label: 'Recusado', bg: '#FEE2E2', color: '#991B1B', Icon: X      },
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const { clinicaId } = useAuthStore()
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('visao_geral')
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))

  const { metricas, proximosVencimentos, carregando, recarregar } =
    useFinanceiro(clinicaId ?? '', mes)
  const { recebimentos, total: totalRecebido, carregando: carregandoRec } =
    useRecebimentos(clinicaId ?? '', mes)
  const { orcamentos, carregando: carregandoOrc } =
    useOrcamentosFinanceiro(clinicaId ?? '')

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
    { id: 'visao_geral',  label: 'Visão Geral'  },
    { id: 'recebimentos', label: 'Recebimentos' },
    { id: 'orcamentos',   label: 'Orçamentos'   },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-gray-50 px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Financeiro</h1>
          <Link
            href="/financeiro/lancamento"
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white active:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Lançar
          </Link>
        </div>
        <div className="flex border-b border-gray-200">
          {abas.map((a: { id: Aba; label: string }) => (
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
                [...Array(3)].map((_: unknown, i: number) => (
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
              [...Array(4)].map((_: unknown, i: number) => (
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
                {recebimentos.map((r: Recebimento) => (
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

        {/* ── Orçamentos ── */}
        {aba === 'orcamentos' && (
          <>
            {!carregandoOrc && orcamentos.length > 0 && (() => {
              const pendentes = orcamentos.filter((o: OrcamentoFinanceiro) => o.status === 'pendente')
              const aprovados = orcamentos.filter((o: OrcamentoFinanceiro) => o.status === 'aprovado')
              const totalPendente = pendentes.reduce((s: number, o: OrcamentoFinanceiro) => s + o.valor_total, 0)
              const totalAprovado = aprovados.reduce((s: number, o: OrcamentoFinanceiro) => s + o.valor_total, 0)
              return (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-yellow-50 rounded-2xl px-3 py-3">
                    <p className="text-xs text-yellow-700 font-medium">{pendentes.length} Pendente{pendentes.length !== 1 ? 's' : ''}</p>
                    <p className="text-base font-bold text-yellow-800 mt-0.5">{formatarMoeda(totalPendente)}</p>
                  </div>
                  <div className="bg-green-50 rounded-2xl px-3 py-3">
                    <p className="text-xs text-green-700 font-medium">{aprovados.length} Aprovado{aprovados.length !== 1 ? 's' : ''}</p>
                    <p className="text-base font-bold text-green-800 mt-0.5">{formatarMoeda(totalAprovado)}</p>
                  </div>
                </div>
              )
            })()}

            {carregandoOrc ? (
              [...Array(3)].map((_: unknown, i: number) => (
                <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
              ))
            ) : orcamentos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="font-medium text-gray-500">Nenhum orçamento criado ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orcamentos.map((o: OrcamentoFinanceiro) => {
                  const cfg = STATUS_ORC[o.status]
                  return (
                    <button
                      key={o.id}
                      onClick={() => router.push(`/pacientes/${o.paciente_id}/orcamentos`)}
                      className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm text-left active:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{o.paciente_nome}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {o.num_itens} item{o.num_itens !== 1 ? 's' : ''} · {formatarData(o.created_at.split('T')[0])}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-sm font-bold text-gray-900">{formatarMoeda(o.valor_total)}</span>
                          <span
                            className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            <cfg.Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}