// src/app/(app)/pacientes/[id]/financeiro/FinanceiroAba.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Check, X, Trash2, ChevronRight, Clock,
  RefreshCw, DollarSign,
} from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { formatarMoeda, formatarData } from '@/lib/utils'
import { registrarPagamentoPaciente, excluirPagamentoParcela } from '@/lib/hooks/useFinanceiroPaciente'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type StatusOrcamento = 'pendente' | 'aprovado' | 'recusado'

interface ItemOrcamento {
  id: string
  procedimento_nome: string
  valor: number
}

interface Orcamento {
  id: string
  status: StatusOrcamento
  observacoes: string | null
  created_at: string
  itens: ItemOrcamento[]
  valor_total: number
}

interface Pagamento {
  id: string
  lancamento_id: string
  descricao_lancamento: string
  valor_pago: number
  data_pagamento: string
  forma_pagamento: string | null
}

interface LancamentoSimplificado {
  id: string
  descricao: string
  valor_total: number
  valor_pago: number
  valor_pendente: number
}

interface ResumoFinanceiro {
  totalOrcado: number
  totalPago: number
  saldoDevedor: number
}

// ─── Configurações ────────────────────────────────────────────────────────────

const FORMAS = [
  { id: 'dinheiro',       label: 'Dinheiro',     emoji: '💵' },
  { id: 'pix',            label: 'PIX',           emoji: '📱' },
  { id: 'cartao_credito', label: 'Crédito',       emoji: '💳' },
  { id: 'cartao_debito',  label: 'Débito',        emoji: '💳' },
  { id: 'transferencia',  label: 'Transferência', emoji: '🏦' },
  { id: 'boleto',         label: 'Boleto',        emoji: '📄' },
  { id: 'outros',         label: 'Outros',        emoji: '🪙' },
]

const FORMA_EMOJI: Record<string, string> = Object.fromEntries(FORMAS.map((f) => [f.id, f.emoji]))
const FORMA_LABEL: Record<string, string> = Object.fromEntries(FORMAS.map((f) => [f.id, f.label]))

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', bg: '#FEF9C3', color: '#854D0E', Icon: Clock },
  aprovado: { label: 'Aprovado', bg: '#DCFCE7', color: '#166534', Icon: Check },
  recusado: { label: 'Recusado', bg: '#FEE2E2', color: '#991B1B', Icon: X    },
}

// ─── Modal Registrar Pagamento ─────────────────────────────────────────────────

function ModalRegistrarPagamento({
  pacienteId, clinicaId, lancamentos, lancamentoPreSelecionado, onFechar, onSucesso,
}: {
  pacienteId: string
  clinicaId: string
  lancamentos: LancamentoSimplificado[]
  lancamentoPreSelecionado?: string
  onFechar: () => void
  onSucesso: () => void
}) {
  const hoje = new Date().toISOString().split('T')[0]
  const [lancamentoId, setLancamentoId] = useState(lancamentoPreSelecionado ?? '')
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState('pix')
  const [data, setData] = useState(hoje)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const lancSelecionado = lancamentos.find((l) => l.id === lancamentoId)

  useEffect(() => {
    if (lancSelecionado && !valor) {
      setValor(lancSelecionado.valor_pendente.toFixed(2))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lancamentoId])

  async function handleSalvar() {
    if (!lancamentoId) { setErro('Selecione um lançamento'); return }
    const valorNum = parseFloat(valor)
    if (!valorNum || valorNum <= 0) { setErro('Informe um valor válido'); return }
    setSalvando(true)
    setErro(null)
    const resultado = await registrarPagamentoPaciente({
      clinicaId, pacienteId, lancamentoId,
      valor: valorNum, formaPagamento: forma,
      dataPagamento: data, observacao: observacao || undefined,
    })
    if (!resultado.sucesso) {
      setErro(resultado.erro ?? 'Erro ao registrar')
      setSalvando(false)
      return
    }
    onSucesso()
  }

  const lancsPendentes = lancamentos.filter((l) => l.valor_pendente > 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div className="w-full bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 80px)' }}>
        {/* Header fixo */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Registrar Pagamento</h2>
          <button onClick={onFechar} className="p-1 text-gray-400 text-xl leading-none">✕</button>
        </div>

        {/* Corpo scrollável */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Referente a
            </label>
            {lancsPendentes.length === 0 ? (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                ✓ Todos os lançamentos estão quitados
              </div>
            ) : (
              <div className="space-y-2">
                {lancsPendentes.map((l) => (
                  <button key={l.id} type="button"
                    onClick={() => { setLancamentoId(l.id); setValor(l.valor_pendente.toFixed(2)) }}
                    className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                      lancamentoId === l.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{l.descricao}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Total: {formatarMoeda(l.valor_total)} · Pago: {formatarMoeda(l.valor_pago)}
                      </p>
                    </div>
                    <div className="ml-3 text-right flex-shrink-0">
                      <p className="text-sm font-bold text-red-600">{formatarMoeda(l.valor_pendente)}</p>
                      <p className="text-xs text-gray-400">pendente</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lancamentoId && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Valor (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">R$</span>
                  <input type="number" step="0.01" min="0.01" value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3.5 text-base font-bold text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                {lancSelecionado && (
                  <button type="button"
                    onClick={() => setValor(lancSelecionado.valor_pendente.toFixed(2))}
                    className="mt-1 text-xs text-blue-600 font-medium"
                  >
                    Usar total pendente ({formatarMoeda(lancSelecionado.valor_pendente)})
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {FORMAS.map((f) => (
                    <button key={f.id} type="button" onClick={() => setForma(f.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 px-1 transition-all ${
                        forma === f.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <span className="text-xl">{f.emoji}</span>
                      <span className={`text-xs font-medium text-center leading-tight ${
                        forma === f.id ? 'text-blue-700' : 'text-gray-600'
                      }`}>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Data do Pagamento
                </label>
                <input type="date" value={data} max={hoje}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Observações (opcional)
                </label>
                <input type="text" placeholder="Ex: Entrada, parcela 1/3..."
                  value={observacao} onChange={(e) => setObservacao(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {erro && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
          )}
        </div>

        {/* Botões fixos na base */}
        <div className="flex-shrink-0 px-5 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3 bg-white" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))' }}>
          <button type="button" onClick={onFechar}
            className="rounded-xl bg-gray-100 py-3.5 text-sm font-semibold text-gray-700 active:bg-gray-200"
          >Cancelar</button>
          <button type="button" onClick={handleSalvar}
            disabled={salvando || !lancamentoId}
            className="rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white disabled:opacity-50 active:bg-blue-700"
          >{salvando ? 'Salvando...' : '✓ Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Confirmar Exclusão ──────────────────────────────────────────────────

function ModalConfirmarExclusao({
  mensagem, onConfirmar, onCancelar, carregando,
}: {
  mensagem: string
  onConfirmar: () => void
  onCancelar: () => void
  carregando: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="w-full bg-white rounded-t-2xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Confirmar exclusão</h2>
        <p className="text-sm text-gray-500">{mensagem}</p>
        <button onClick={onConfirmar} disabled={carregando}
          className="w-full rounded-xl bg-red-600 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >{carregando ? 'Excluindo...' : 'Sim, excluir'}</button>
        <button onClick={onCancelar}
          className="w-full rounded-xl bg-gray-100 py-3.5 text-sm font-medium text-gray-700"
        >Cancelar</button>
      </div>
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function FinanceiroAba({ pacienteId, clinicaId }: { pacienteId: string; clinicaId: string }) {
  const router = useRouter()
  const [subAba, setSubAba] = useState<'orcamentos' | 'pagamentos'>('orcamentos')
  const [carregando, setCarregando] = useState(true)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState('')

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoSimplificado[]>([])
  const [resumo, setResumo] = useState<ResumoFinanceiro>({ totalOrcado: 0, totalPago: 0, saldoDevedor: 0 })

  const [modalPagamento, setModalPagamento] = useState(false)
  const [lancamentoModalId, setLancamentoModalId] = useState<string | undefined>()
  const [exclusaoInfo, setExclusaoInfo] = useState<{
    tipo: 'orcamento' | 'pagamento'
    id: string
    lancamentoId?: string
    mensagem: string
  } | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  // ── Carregar ──────────────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!pacienteId || !clinicaId) return
    setCarregando(true)

    // Orçamentos
    const { data: orcsRaw } = await supabase
      .from('orcamentos').select('*')
      .eq('paciente_id', pacienteId).eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false })

    const orcsDB = (orcsRaw ?? []) as Array<{
      id: string; status: StatusOrcamento; observacoes: string | null; created_at: string
    }>

    let orcamentosCompletos: Orcamento[] = []
    if (orcsDB.length > 0) {
      const { data: itensRaw } = await supabase
        .from('orcamento_itens').select('*')
        .in('orcamento_id', orcsDB.map((o) => o.id))
      const itensDB = (itensRaw ?? []) as Array<{
        id: string; orcamento_id: string; procedimento_nome: string; valor: number
      }>
      const itensPorOrc: Record<string, ItemOrcamento[]> = {}
      itensDB.forEach((item) => {
        if (!itensPorOrc[item.orcamento_id]) itensPorOrc[item.orcamento_id] = []
        itensPorOrc[item.orcamento_id].push({ id: item.id, procedimento_nome: item.procedimento_nome, valor: Number(item.valor) })
      })
      orcamentosCompletos = orcsDB.map((o) => ({
        ...o,
        itens: itensPorOrc[o.id] ?? [],
        valor_total: (itensPorOrc[o.id] ?? []).reduce((s, i) => s + i.valor, 0),
      }))
    }

    // Lançamentos + parcelas
    const { data: lancsRaw } = await supabase
      .from('financeiro_lancamentos').select('id, descricao, valor_total')
      .eq('clinica_id', clinicaId).eq('paciente_id', pacienteId).eq('tipo', 'receita')
      .order('created_at', { ascending: false })

    const lancsDB = (lancsRaw ?? []) as Array<{ id: string; descricao: string; valor_total: number }>

    let totalOrcado = 0
    let totalPago = 0
    const lancamentosProcessados: LancamentoSimplificado[] = []
    const pagamentosColetados: Pagamento[] = []

    if (lancsDB.length > 0) {
      const lancIds = lancsDB.map((l) => l.id)
      const { data: parcelasRaw } = await supabase
        .from('financeiro_parcelas')
        .select('id, lancamento_id, valor, valor_pago, data_pagamento, status')
        .in('lancamento_id', lancIds)
        .order('data_pagamento', { ascending: false })

      const parcelasDB = (parcelasRaw ?? []) as Array<{
        id: string; lancamento_id: string; valor: number
        valor_pago: number | null; data_pagamento: string | null; status: string
      }>

      const parcelasPorLanc: Record<string, typeof parcelasDB> = {}
      parcelasDB.forEach((p) => {
        if (!parcelasPorLanc[p.lancamento_id]) parcelasPorLanc[p.lancamento_id] = []
        parcelasPorLanc[p.lancamento_id].push(p)
      })

      lancsDB.forEach((l) => {
        const parcs = parcelasPorLanc[l.id] ?? []
        const valorPagoLanc = parcs
          .filter((p) => p.status === 'pago' || p.status === 'pago_parcial')
          .reduce((acc, p) => acc + (p.valor_pago ?? 0), 0)

        totalOrcado += l.valor_total
        totalPago += valorPagoLanc

        lancamentosProcessados.push({
          id: l.id, descricao: l.descricao, valor_total: l.valor_total,
          valor_pago: valorPagoLanc,
          valor_pendente: Math.max(0, l.valor_total - valorPagoLanc),
        })

        parcs
          .filter((p) => (p.status === 'pago' || p.status === 'pago_parcial') && p.data_pagamento)
          .forEach((p) => {
            pagamentosColetados.push({
              id: p.id, lancamento_id: l.id, descricao_lancamento: l.descricao,
              valor_pago: p.valor_pago ?? p.valor,
              data_pagamento: p.data_pagamento!,
              forma_pagamento: null,
            })
          })
      })
    }

    pagamentosColetados.sort((a, b) => b.data_pagamento.localeCompare(a.data_pagamento))

    setOrcamentos(orcamentosCompletos)
    setLancamentos(lancamentosProcessados)
    setPagamentos(pagamentosColetados)
    setResumo({ totalOrcado, totalPago, saldoDevedor: Math.max(0, totalOrcado - totalPago) })
    setUltimaAtualizacao(new Date().toLocaleTimeString('pt-BR'))
    setCarregando(false)
  }, [pacienteId, clinicaId])

  useEffect(() => { carregar() }, [carregar])

  // ── Ações ─────────────────────────────────────────────────────────────────────

  async function mudarStatusOrcamento(id: string, status: StatusOrcamento) {
    await supabase.from('orcamentos').update({ status }).eq('id', id)
    setOrcamentos((prev) => prev.map((o) => o.id === id ? { ...o, status } : o))
  }

  function gerarCobranca(orc: Orcamento) {
    const params = new URLSearchParams({
      paciente: pacienteId, orcamento: orc.id,
      valor: orc.valor_total.toString(),
      descricao: `Orçamento – ${orc.itens.map((i) => i.procedimento_nome).join(', ')}`,
    })
    router.push(`/financeiro/lancamento?${params}`)
  }

  async function excluirOrcamento(id: string) {
    setExcluindo(true)

    // Buscar o orçamento para saber o valor
    const orc = orcamentos.find((o) => o.id === id)
    if (orc) {
      // Buscar lançamentos financeiros com mesmo valor vinculados ao paciente
      const { data: lancsVinculados } = await supabase
        .from('financeiro_lancamentos')
        .select('id')
        .eq('clinica_id', clinicaId)
        .eq('paciente_id', pacienteId)
        .eq('valor_total', orc.valor_total)
        .eq('tipo', 'receita')

      if (lancsVinculados && lancsVinculados.length > 0) {
        const lancIds = (lancsVinculados as { id: string }[]).map((l) => l.id)
        // Apagar parcelas e lançamentos vinculados
        await supabase.from('financeiro_parcelas').delete().in('lancamento_id', lancIds)
        await supabase.from('financeiro_lancamentos').delete().in('id', lancIds)
      }
    }

    // Apagar itens e o orçamento
    await supabase.from('orcamento_itens').delete().eq('orcamento_id', id)
    await supabase.from('orcamentos').delete().eq('id', id)

    setExclusaoInfo(null)
    setExcluindo(false)
    await carregar()
  }

  async function excluirPagamento(parcelaId: string) {
    setExcluindo(true)
    await excluirPagamentoParcela(parcelaId)
    setExclusaoInfo(null)
    setExcluindo(false)
    await carregar()
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-7 w-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-xs text-gray-400 mt-3">Carregando financeiro...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Título */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Financeiro do Paciente</h3>
          {ultimaAtualizacao && (
            <p className="text-xs text-gray-400 mt-0.5">Última atualização: {ultimaAtualizacao}</p>
          )}
        </div>
        <button onClick={carregar}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-blue-700"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar Dados
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className="text-base font-bold text-blue-600">{formatarMoeda(resumo.totalOrcado)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Orçado</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className="text-base font-bold text-green-600">{formatarMoeda(resumo.totalPago)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Pago</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className={`text-base font-bold ${resumo.saldoDevedor > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatarMoeda(resumo.saldoDevedor)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Saldo Devedor</p>
        </div>
      </div>

      {/* Sub-abas + botão contextual */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          <button onClick={() => setSubAba('orcamentos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              subAba === 'orcamentos' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-500 bg-white'
            }`}
          >
            📋 Orçamentos ({orcamentos.length})
          </button>
          <button onClick={() => setSubAba('pagamentos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              subAba === 'pagamentos' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-500 bg-white'
            }`}
          >
            💳 Pagamentos ({pagamentos.length})
          </button>
        </div>

        {subAba === 'orcamentos' ? (
          <button onClick={() => router.push(`/pacientes/${pacienteId}/orcamentos`)}
            className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white active:bg-blue-700 flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Novo Orçamento
          </button>
        ) : (
          <button onClick={() => { setLancamentoModalId(undefined); setModalPagamento(true) }}
            className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white active:bg-blue-700 flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Registrar Pagamento
          </button>
        )}
      </div>

      {/* ── Orçamentos ── */}
      {subAba === 'orcamentos' && (
        <div className="space-y-3">
          {orcamentos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <p className="text-4xl mb-2">📋</p>
              <p className="text-sm font-medium text-gray-500">Nenhum orçamento ainda</p>
              <p className="text-xs text-gray-400 mt-1">Toque em "Novo Orçamento" para criar</p>
            </div>
          ) : (
            orcamentos.map((orc) => {
              const cfg = STATUS_CONFIG[orc.status]
              // Tentar encontrar lançamento vinculado por valor
              const lancOrc = lancamentos.find((l) => l.valor_total === orc.valor_total)
              const valorPago = lancOrc?.valor_pago ?? 0
              const saldo = orc.valor_total - valorPago
              const pctPago = orc.valor_total > 0
                ? Math.min(100, Math.round((valorPago / orc.valor_total) * 100))
                : 0

              return (
                <div key={orc.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
                    <div>
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full mb-1"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        <cfg.Icon className="h-3 w-3" /> {cfg.label}
                      </span>
                      <p className="text-xs text-gray-400">{formatarData(orc.created_at.split('T')[0])}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatarMoeda(orc.valor_total)}</p>
                      {saldo > 0 && (
                        <p className="text-xs text-red-500">Saldo: {formatarMoeda(saldo)}</p>
                      )}
                    </div>
                  </div>

                  {/* Itens */}
                  <div className="px-4 pb-2 space-y-1 border-t border-gray-50 pt-2">
                    {orc.itens.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-600 truncate flex-1">{item.procedimento_nome}</span>
                        <span className="text-gray-500 ml-3 flex-shrink-0">{formatarMoeda(item.valor)}</span>
                      </div>
                    ))}
                    {orc.observacoes && (
                      <p className="text-xs text-gray-400 italic pt-1">{orc.observacoes}</p>
                    )}
                  </div>

                  {/* Barra de progresso */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pctPago}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{pctPago}%</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Pago: <span className="font-semibold text-green-600">{formatarMoeda(valorPago)}</span>
                    </p>
                  </div>

                  {/* Ações por status */}
                  {orc.status === 'pendente' && (
                    <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
                      <button
                        onClick={async () => { await mudarStatusOrcamento(orc.id, 'aprovado'); gerarCobranca({ ...orc, status: 'aprovado' }) }}
                        className="flex items-center justify-center gap-1 py-3 text-sm font-semibold text-green-700 active:bg-green-50"
                      ><Check className="h-4 w-4" /> Aprovar</button>
                      <button
                        onClick={() => mudarStatusOrcamento(orc.id, 'recusado')}
                        className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-red-500 active:bg-red-50"
                      ><X className="h-4 w-4" /> Recusar</button>
                      <button
                        onClick={() => setExclusaoInfo({ tipo: 'orcamento', id: orc.id, mensagem: `Excluir orçamento de ${formatarMoeda(orc.valor_total)}? Esta ação não pode ser desfeita.` })}
                        className="flex items-center justify-center py-3 text-gray-400 active:bg-gray-50"
                      ><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}

                  {orc.status === 'aprovado' && (
                    <div className="border-t border-gray-100 flex divide-x divide-gray-100">
                      <button
                        onClick={() => {
                          if (lancOrc && lancOrc.valor_pendente > 0) {
                            setLancamentoModalId(lancOrc.id)
                            setModalPagamento(true)
                          } else {
                            gerarCobranca(orc)
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-blue-600 active:bg-blue-50"
                      >
                        <DollarSign className="h-4 w-4" />
                        {lancOrc && lancOrc.valor_pendente > 0 ? 'Pagar' : 'Gerar Cobrança'}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setExclusaoInfo({ tipo: 'orcamento', id: orc.id, mensagem: `Excluir orçamento de ${formatarMoeda(orc.valor_total)}? Esta ação não pode ser desfeita.` })}
                        className="px-4 py-3 text-gray-400 active:bg-gray-50"
                      ><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}

                  {orc.status === 'recusado' && (
                    <div className="border-t border-gray-100 flex divide-x divide-gray-100">
                      <button onClick={() => mudarStatusOrcamento(orc.id, 'pendente')}
                        className="flex-1 py-3 text-sm font-medium text-gray-500 active:bg-gray-50"
                      >Reabrir</button>
                      <button
                        onClick={() => setExclusaoInfo({ tipo: 'orcamento', id: orc.id, mensagem: `Excluir orçamento de ${formatarMoeda(orc.valor_total)}? Esta ação não pode ser desfeita.` })}
                        className="px-4 py-3 text-gray-400 active:bg-gray-50"
                      ><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Pagamentos ── */}
      {subAba === 'pagamentos' && (
        <div>
          {pagamentos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <p className="text-4xl mb-2">💳</p>
              <p className="text-sm font-medium text-gray-500">Nenhum pagamento registrado</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {pagamentos.map((p, idx) => (
                <div key={p.id}
                  className={`flex items-center gap-3 px-4 py-3 ${idx < pagamentos.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  {/* Ícone */}
                  <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-lg">
                    {p.forma_pagamento ? (FORMA_EMOJI[p.forma_pagamento] ?? '💵') : '💵'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{formatarMoeda(p.valor_pago)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.forma_pagamento ? FORMA_LABEL[p.forma_pagamento] : 'Pagamento'}
                      {' • '}{formatarData(p.data_pagamento)}
                    </p>
                    <p className="text-xs text-gray-400 truncate">Ref. {p.descricao_lancamento}</p>
                  </div>

                  {/* Excluir */}
                  <button
                    onClick={() => setExclusaoInfo({
                      tipo: 'pagamento', id: p.id, lancamentoId: p.lancamento_id,
                      mensagem: `Excluir o pagamento de ${formatarMoeda(p.valor_pago)}? O saldo do lançamento será revertido.`,
                    })}
                    className="text-xs font-semibold text-red-400 active:text-red-600 flex-shrink-0"
                  >Excluir</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {modalPagamento && (
        <ModalRegistrarPagamento
          pacienteId={pacienteId} clinicaId={clinicaId}
          lancamentos={lancamentos}
          lancamentoPreSelecionado={lancamentoModalId}
          onFechar={() => { setModalPagamento(false); setLancamentoModalId(undefined) }}
          onSucesso={async () => { setModalPagamento(false); setLancamentoModalId(undefined); await carregar() }}
        />
      )}

      {exclusaoInfo && (
        <ModalConfirmarExclusao
          mensagem={exclusaoInfo.mensagem}
          carregando={excluindo}
          onCancelar={() => setExclusaoInfo(null)}
          onConfirmar={async () => {
            if (exclusaoInfo.tipo === 'orcamento') await excluirOrcamento(exclusaoInfo.id)
            else await excluirPagamento(exclusaoInfo.id)
          }}
        />
      )}
    </div>
  )
}