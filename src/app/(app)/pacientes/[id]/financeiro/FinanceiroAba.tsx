// src/app/(app)/pacientes/[id]/financeiro/FinanceiroAba.tsx
'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Plus, TrendingUp, TrendingDown, Wallet, ChevronDown, ChevronRight, Check, Clock } from 'lucide-react'
import { formatarMoeda, formatarData } from '@/lib/utils'
import { useFinanceiroPaciente, registrarPagamentoPaciente, type LancamentoPaciente } from '@/lib/hooks/useFinanceiroPaciente'

// ─── Formas de Pagamento ──────────────────────────────────────────────────────

const FORMAS = [
  { id: 'dinheiro',      label: 'Dinheiro',     emoji: '💵' },
  { id: 'pix',           label: 'PIX',           emoji: '📱' },
  { id: 'cartao_credito', label: 'Crédito',      emoji: '💳' },
  { id: 'cartao_debito',  label: 'Débito',       emoji: '💳' },
  { id: 'transferencia', label: 'Transferência', emoji: '🏦' },
  { id: 'boleto',        label: 'Boleto',        emoji: '📄' },
  { id: 'outros',        label: 'Outros',        emoji: '🪙' },
]

// ─── Modal Registrar Pagamento ─────────────────────────────────────────────────

interface ModalPagamentoProps {
  pacienteId: string
  clinicaId: string
  lancamentos: LancamentoPaciente[]
  lancamentoPreSelecionado?: string
  onFechar: () => void
  onSucesso: () => void
}

function ModalRegistrarPagamento({
  pacienteId,
  clinicaId,
  lancamentos,
  lancamentoPreSelecionado,
  onFechar,
  onSucesso,
}: ModalPagamentoProps) {
  const hoje = new Date().toISOString().split('T')[0]

  const [lancamentoId, setLancamentoId] = useState(lancamentoPreSelecionado ?? '')
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState('pix')
  const [data, setData] = useState(hoje)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Ao selecionar lançamento, preencher valor pendente automaticamente
  const lancSelecionado = lancamentos.find((l) => l.id === lancamentoId)
  useEffect(() => {
    if (lancSelecionado && !valor) {
      setValor(lancSelecionado.valor_pendente.toFixed(2))
    }
  }, [lancamentoId, lancSelecionado, valor])

  async function handleSalvar() {
    if (!lancamentoId) { setErro('Selecione um lançamento'); return }
    const valorNum = parseFloat(valor)
    if (!valorNum || valorNum <= 0) { setErro('Informe um valor válido'); return }
    if (!data) { setErro('Informe a data'); return }

    setSalvando(true)
    setErro(null)

    const resultado = await registrarPagamentoPaciente({
      clinicaId,
      pacienteId,
      lancamentoId,
      valor: valorNum,
      formaPagamento: forma,
      dataPagamento: data,
      observacao: observacao || undefined,
    })

    if (!resultado.sucesso) {
      setErro(resultado.erro ?? 'Erro ao registrar pagamento')
      setSalvando(false)
      return
    }

    onSucesso()
  }

  // Apenas lançamentos com saldo pendente
  const lancsPendentes = lancamentos.filter((l) => l.valor_pendente > 0)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div 
        className="w-full bg-white rounded-t-3xl flex flex-col shadow-2xl transition-all duration-300 ease-out" 
        style={{ height: 'auto', maxHeight: '94vh' }}
      >
        {/* Header — Fixo */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Registrar Pagamento</h2>
          <button onClick={onFechar} className="p-2 -mr-2 rounded-full text-gray-400 active:bg-gray-100">
            <span className="text-xl">✕</span>
          </button>
        </div>

        {/* Corpo scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
          {/* Selecionar Lançamento */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              Referente a
            </label>
            {lancsPendentes.length === 0 ? (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                ✓ Todos os lançamentos estão quitados
              </div>
            ) : (
              <div className="space-y-2">
                {lancsPendentes.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setLancamentoId(l.id)
                      setValor(l.valor_pendente.toFixed(2))
                    }}
                    className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                      lancamentoId === l.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white active:bg-gray-50'
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
              {/* Valor */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Valor (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3.5 text-base font-bold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                {lancSelecionado && (
                  <button
                    type="button"
                    onClick={() => setValor(lancSelecionado.valor_pendente.toFixed(2))}
                    className="mt-1 text-xs text-blue-600 font-medium"
                  >
                    Usar valor total pendente ({formatarMoeda(lancSelecionado.valor_pendente)})
                  </button>
                )}
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {FORMAS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setForma(f.id)}
                      className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 px-1 transition-all ${
                        forma === f.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white active:bg-gray-50'
                      }`}
                    >
                      <span className="text-xl">{f.emoji}</span>
                      <span className={`text-xs font-medium leading-tight text-center ${
                        forma === f.id ? 'text-blue-700' : 'text-gray-600'
                      }`}>
                        {f.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Data do Pagamento
                </label>
                <input
                  type="date"
                  value={data}
                  max={hoje}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Observação */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Observações (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Entrada, parcela 1/3..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {erro && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
          )}

          {/* Espaçador extra para o conteúdo não ficar escondido pelos botões no fim do scroll */}
          <div className="h-10" />
        </div>

        {/* Botões — Fixos na base com padding para áreas seguras mobile */}
        <div className="flex-shrink-0 px-6 pb-10 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 bg-white shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-2xl bg-gray-100 py-4 text-sm font-bold text-gray-700 active:scale-95 transition-transform"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || !lancamentoId}
            className="rounded-2xl bg-blue-600 py-4 text-sm font-bold text-white disabled:opacity-50 active:scale-95 transition-transform shadow-lg shadow-blue-200"
          >
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card Lançamento (expansível) ─────────────────────────────────────────────

function LancamentoCard({
  lancamento,
  onRegistrarPagamento,
}: {
  lancamento: LancamentoPaciente
  onRegistrarPagamento: (lancamentoId: string) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const percentualPago = lancamento.valor_total > 0
    ? Math.round((lancamento.valor_pago / lancamento.valor_total) * 100)
    : 0
  const quitado = lancamento.valor_pendente <= 0

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left active:bg-gray-50"
      >
        {/* Ícone status */}
        <div className={`mt-0.5 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          quitado ? 'bg-green-100' : 'bg-amber-100'
        }`}>
          {quitado
            ? <Check className="h-4 w-4 text-green-600" />
            : <Clock className="h-4 w-4 text-amber-600" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{lancamento.descricao}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatarData(lancamento.created_at)}</p>

          {/* Barra de progresso */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${quitado ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${percentualPago}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500">{percentualPago}%</span>
          </div>
        </div>

        <div className="text-right flex-shrink-0 ml-2">
          <p className="text-sm font-bold text-gray-900">{formatarMoeda(lancamento.valor_total)}</p>
          {!quitado && (
            <p className="text-xs text-red-500 mt-0.5">-{formatarMoeda(lancamento.valor_pendente)}</p>
          )}
          {quitado && (
            <p className="text-xs text-green-600 mt-0.5">Quitado</p>
          )}
        </div>

        <div className="ml-1 flex-shrink-0 mt-1">
          {expandido
            ? <ChevronDown className="h-4 w-4 text-gray-400" />
            : <ChevronRight className="h-4 w-4 text-gray-400" />
          }
        </div>
      </button>

      {expandido && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Resumo financeiro */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-center">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-sm font-bold text-gray-900">{formatarMoeda(lancamento.valor_total)}</p>
            </div>
            <div className="rounded-xl bg-green-50 px-3 py-2 text-center">
              <p className="text-xs text-green-600">Pago</p>
              <p className="text-sm font-bold text-green-700">{formatarMoeda(lancamento.valor_pago)}</p>
            </div>
            <div className={`rounded-xl px-3 py-2 text-center ${quitado ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-xs ${quitado ? 'text-green-600' : 'text-red-500'}`}>Saldo</p>
              <p className={`text-sm font-bold ${quitado ? 'text-green-700' : 'text-red-600'}`}>
                {formatarMoeda(lancamento.valor_pendente)}
              </p>
            </div>
          </div>

          {/* Histórico de pagamentos */}
          {lancamento.pagamentos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Pagamentos realizados
              </p>
              <div className="space-y-1.5">
                {lancamento.pagamentos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-600">{formatarData(p.data_pagamento)}</span>
                    </div>
                    <span className="font-semibold text-green-700">{formatarMoeda(p.valor_pago)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botão registrar */}
          {!quitado && (
            <button
              type="button"
              onClick={() => onRegistrarPagamento(lancamento.id)}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white active:bg-blue-700 transition-colors"
            >
              + Registrar Pagamento
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface FinanceiroAbaProps {
  pacienteId: string
  clinicaId: string
}

export function FinanceiroAba({ pacienteId, clinicaId }: FinanceiroAbaProps) {
  const { lancamentos, pagamentos, resumo, carregando, ultimaAtualizacao, recarregar } =
    useFinanceiroPaciente(pacienteId, clinicaId)

  const [subAba, setSubAba] = useState<'lancamentos' | 'pagamentos'>('lancamentos')
  const [modalAberto, setModalAberto] = useState(false)
  const [lancamentoModalId, setLancamentoModalId] = useState<string | undefined>(undefined)

  // Carregar ao montar
  useEffect(() => {
    recarregar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirModalPagamento(lancamentoId?: string) {
    setLancamentoModalId(lancamentoId)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setLancamentoModalId(undefined)
  }

  async function aposRegistrar() {
    fecharModal()
    await recarregar()
  }

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="h-7 w-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-xs text-gray-400 mt-3">Carregando financeiro...</p>
      </div>
    )
  }

  const temPendente = resumo.saldoDevedor > 0

  return (
    <div className="space-y-4">
      {/* Header com título e botões */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Financeiro do Paciente</h3>
          {ultimaAtualizacao && (
            <p className="text-xs text-gray-400 mt-0.5">Última atualização: {ultimaAtualizacao}</p>
          )}
        </div>
        <button
          onClick={recarregar}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-blue-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className="flex items-center justify-center mb-1">
            <Wallet className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-base font-bold text-blue-600">{formatarMoeda(resumo.totalOrcado)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Gerado</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-base font-bold text-green-600">{formatarMoeda(resumo.totalPago)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Pago</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingDown className={`h-4 w-4 ${temPendente ? 'text-red-500' : 'text-green-500'}`} />
          </div>
          <p className={`text-base font-bold ${temPendente ? 'text-red-600' : 'text-green-600'}`}>
            {formatarMoeda(resumo.saldoDevedor)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Saldo Devedor</p>
        </div>
      </div>

      {/* Sub-abas + botão registrar */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-xl bg-gray-100 p-0.5">
          <button
            onClick={() => setSubAba('lancamentos')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              subAba === 'lancamentos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Cobranças ({lancamentos.length})
          </button>
          <button
            onClick={() => setSubAba('pagamentos')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              subAba === 'pagamentos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Pagamentos ({pagamentos.length})
          </button>
        </div>
        <button
          onClick={() => abrirModalPagamento()}
          className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white active:bg-blue-700 flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Registrar
        </button>
      </div>

      {/* Conteúdo sub-aba */}
      {subAba === 'lancamentos' && (
        <div className="space-y-2">
          {lancamentos.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <Wallet className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma cobrança registrada</p>
              <p className="text-xs text-gray-300 mt-1">
                Registre um atendimento e lance a cobrança
              </p>
            </div>
          ) : (
            lancamentos.map((l) => (
              <LancamentoCard
                key={l.id}
                lancamento={l}
                onRegistrarPagamento={abrirModalPagamento}
              />
            ))
          )}
        </div>
      )}

      {subAba === 'pagamentos' && (
        <div className="space-y-2">
          {pagamentos.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <TrendingUp className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhum pagamento registrado</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {pagamentos.map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    idx < pagamentos.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">
                        {p.descricao_lancamento}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.data_pagamento ? formatarData(p.data_pagamento) : '—'}
                        {p.forma_pagamento && (
                          <span className="ml-1 capitalize">· {p.forma_pagamento.replace('_', ' ')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-green-700 flex-shrink-0 ml-2">
                    {formatarMoeda(p.valor_pago)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <ModalRegistrarPagamento
          pacienteId={pacienteId}
          clinicaId={clinicaId}
          lancamentos={lancamentos}
          lancamentoPreSelecionado={lancamentoModalId}
          onFechar={fecharModal}
          onSucesso={aposRegistrar}
        />
      )}
    </div>
  )
}