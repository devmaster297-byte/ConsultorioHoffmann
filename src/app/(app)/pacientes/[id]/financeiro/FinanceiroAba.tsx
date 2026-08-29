// src/app/(app)/pacientes/[id]/financeiro/FinanceiroAba.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, X, Trash2, RefreshCw, DollarSign, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { formatarMoeda, formatarData } from '@/lib/utils'
import { registrarPagamentoPaciente, excluirPagamentoParcela } from '@/lib/hooks/useFinanceiroPaciente'

// ─── Prefixo de identificação ────────────────────────────────────────────────
// FIX CRÍTICO: Em vez de buscar o lançamento por valor_total (que colide quando
// dois orçamentos têm o mesmo valor), codificamos o ID do orçamento na descrição
// do lançamento. Formato: "[orc:UUID] Procedimento1, Procedimento2"
// Isso garante lookup exato por UUID mesmo sem adicionar coluna ao banco.

const ORC_PREFIX = (orcId: string) => `[orc:${orcId}]`
const DESCRICAO_LANCAMENTO = (orc: Orcamento): string =>
  `${ORC_PREFIX(orc.id)} ${orc.itens.map((i) => i.procedimento_nome).join(', ')}`

function extrairOrcamentoIdDaDescricao(descricao: string): string | null {
  const match = descricao.match(/^\[orc:([a-f0-9-]{36})\]/)
  return match ? match[1] : null
}

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

interface OrcamentoComSaldo {
  orcamento: Orcamento
  lancamentoId: string | null
  valor_pago: number
  valor_pendente: number
}

interface ResumoFinanceiro {
  totalOrcado: number
  totalPago: number
  saldoDevedor: number
}

// ─── Configurações ────────────────────────────────────────────────────────────

const DENTISTAS = [
  { key: 'rosieli', nome: 'Drª Rosieli Hoffmann',   initials: 'RH', cor: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'eduardo', nome: 'Drº Eduardo Corteletti', initials: 'EC', cor: 'bg-blue-100 text-blue-700 border-blue-200'       },
  { key: 'pamela',  nome: 'Drª Pamela Bolsoni',     initials: 'PB', cor: 'bg-rose-100 text-rose-700 border-rose-200'      },
]

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

// ─── Modal Registrar Pagamento ────────────────────────────────────────────────

function ModalRegistrarPagamento({
  pacienteId, clinicaId, orcamentoComSaldo, onFechar, onSucesso,
}: {
  pacienteId: string
  clinicaId: string
  orcamentoComSaldo: OrcamentoComSaldo
  onFechar: () => void
  onSucesso: () => void
}) {
  const hoje = new Date().toISOString().split('T')[0]
  const { orcamento, valor_pendente } = orcamentoComSaldo

  const [valor, setValor] = useState(valor_pendente.toFixed(2))
  const [forma, setForma] = useState('pix')
  const [data, setData] = useState(hoje)
  const [observacao, setObservacao] = useState('')
  const [dentistaKey, setDentistaKey] = useState<'rosieli' | 'eduardo' | 'pamela'>('rosieli')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // FIX: buscar lançamento por prefixo "[orc:UUID]" na descrição — lookup exato por ID
  async function getOuCriarLancamento(): Promise<string | null> {
    const prefixo = ORC_PREFIX(orcamento.id)

    // Busca primeiro pela FK orcamento_id — ela é preenchida por QUALQUER
    // fluxo que cria lançamento (parcelamento formal em /financeiro/lancamento,
    // avulso, este daqui), então acha um lançamento independente de qual tela
    // o criou. Antes, essa busca olhava só o texto da descrição, e por isso
    // não enxergava lançamento criado por outro fluxo — criava um segundo do
    // zero. Só cai pra busca por texto em registros antigos, de antes da FK
    // existir.
    const { data: porFk } = await supabase
      .from('financeiro_lancamentos')
      .select('id')
      .eq('clinica_id', clinicaId)
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'receita')
      .eq('orcamento_id', orcamento.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let existente = porFk as { id: string } | null

    if (!existente) {
      const { data: porDescricao } = await supabase
        .from('financeiro_lancamentos')
        .select('id')
        .eq('clinica_id', clinicaId)
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'receita')
        .ilike('descricao', `${prefixo}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      existente = porDescricao as { id: string } | null
    }

    if (existente) {
      const lancId = existente.id
      // Atualizar descrição para incluir prefixo do dentista, se não tiver
      const { data: lancAtual } = await supabase
        .from('financeiro_lancamentos').select('descricao').eq('id', lancId).single()
      const descAtual = (lancAtual as { descricao: string } | null)?.descricao ?? ''
      if (!descAtual.includes(`[${dentistaKey}]`)) {
        // Remove prefixo antigo de dentista se houver e adiciona o novo
        const novaDesc = descAtual.replace(/\[[a-z]+\](?!\s*[a-f0-9])/, '').replace(/^(\[orc:[^\]]+\])/, `$1[${dentistaKey}]`)
        await supabase.from('financeiro_lancamentos').update({ descricao: novaDesc }).eq('id', lancId)
      }
      return lancId
    }

    // Não existe — criar com prefixo do orçamento + prefixo do dentista
    const descricaoCompleta = `${ORC_PREFIX(orcamento.id)}[${dentistaKey}] ${orcamento.itens.map(i => i.procedimento_nome).join(', ')}`
    const { data: novoLanc, error } = await supabase
      .from('financeiro_lancamentos')
      .insert({
        clinica_id: clinicaId,
        paciente_id: pacienteId,
        tipo: 'receita',
        orcamento_id: orcamento.id,
        descricao: descricaoCompleta,
        valor_total: orcamento.valor_total,
        num_parcelas: 1,
      })
      .select('id')
      .single()

    if (error || !novoLanc) return null

    return (novoLanc as { id: string }).id
  }

  async function handleSalvar() {
    const valorNum = parseFloat(valor)
    if (!valorNum || valorNum <= 0) { setErro('Informe um valor válido'); return }
    if (valorNum > valor_pendente + 0.01) {
      setErro(`Valor maior que o saldo pendente (${formatarMoeda(valor_pendente)})`)
      return
    }

    setSalvando(true)
    setErro(null)

    const lancamentoId = await getOuCriarLancamento()
    if (!lancamentoId) {
      setErro('Erro ao preparar cobrança. Tente novamente.')
      setSalvando(false)
      return
    }

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div className="w-full bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 80px)' }}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Registrar Pagamento</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {orcamento.itens.map((i) => i.procedimento_nome).join(', ')}
            </p>
          </div>
          <button onClick={onFechar} className="p-1 text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Resumo */}
          <div className="rounded-xl bg-blue-50 px-4 py-3 flex justify-between items-center">
            <div>
              <p className="text-xs text-blue-500 font-medium">Total do orçamento</p>
              <p className="text-base font-bold text-blue-800">{formatarMoeda(orcamento.valor_total)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-red-400 font-medium">Saldo pendente</p>
              <p className="text-base font-bold text-red-600">{formatarMoeda(valor_pendente)}</p>
            </div>
          </div>

          {/* Valor */}
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
            <button type="button"
              onClick={() => setValor(valor_pendente.toFixed(2))}
              className="mt-1 text-xs text-blue-600 font-medium"
            >
              Usar total pendente ({formatarMoeda(valor_pendente)})
            </button>
          </div>

          {/* Dentista */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Dentista
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DENTISTAS.map((d) => (
                <button key={d.key} type="button" onClick={() => setDentistaKey(d.key as 'rosieli' | 'eduardo' | 'pamela')}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all ${
                    dentistaKey === d.key
                      ? 'border-blue-500 bg-blue-50 font-semibold'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    dentistaKey === d.key ? 'bg-blue-500 text-white' : d.cor.split(' ').slice(0,2).join(' ')
                  }`}>
                    {d.initials}
                  </div>
                  <span className={`text-xs ${dentistaKey === d.key ? 'text-blue-800' : 'text-gray-600'}`}>
                    {d.nome}
                  </span>
                  {dentistaKey === d.key && (
                    <span className="ml-auto text-blue-500 text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Forma de pagamento */}
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

          {/* Data */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Data do Pagamento
            </label>
            <input type="date" value={data} max={hoje}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Observações (opcional)
            </label>
            <input type="text" placeholder="Ex: Entrada, parcela 1/3..."
              value={observacao} onChange={(e) => setObservacao(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
          )}
        </div>

        <div
          className="flex-shrink-0 px-5 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3 bg-white"
          style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))' }}
        >
          <button type="button" onClick={onFechar}
            className="rounded-xl bg-gray-100 py-3.5 text-sm font-semibold text-gray-700 active:bg-gray-200"
          >Cancelar</button>
          <button type="button" onClick={handleSalvar} disabled={salvando}
            className="rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white disabled:opacity-50 active:bg-blue-700"
          >{salvando ? 'Salvando...' : '✓ Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Confirmar Exclusão ─────────────────────────────────────────────────

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
  const [orcamentosComSaldo, setOrcamentosComSaldo] = useState<OrcamentoComSaldo[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [resumo, setResumo] = useState<ResumoFinanceiro>({ totalOrcado: 0, totalPago: 0, saldoDevedor: 0 })

  const [modalOrcamento, setModalOrcamento] = useState<OrcamentoComSaldo | null>(null)
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
        itensPorOrc[item.orcamento_id].push({
          id: item.id,
          procedimento_nome: item.procedimento_nome,
          valor: Number(item.valor),
        })
      })
      orcamentosCompletos = orcsDB.map((o) => ({
        ...o,
        itens: itensPorOrc[o.id] ?? [],
        valor_total: (itensPorOrc[o.id] ?? []).reduce((s, i) => s + i.valor, 0),
      }))
    }

    // FIX: Lançamentos buscados por prefixo do orçamento na descrição
    // Monta um mapa: orcamento_id → lancamento
    const lancPorOrcId: Record<string, { id: string; descricao: string; valor_total: number }> = {}
    const lancPagoMap: Record<string, number> = {}
    const pagamentosColetados: Pagamento[] = []

    // FIX: Busca TODOS os lançamentos de receita do paciente (orçamentos + avulsos)
    // Antes, a query ficava dentro do `if (orcamentosCompletos.length > 0)`, o que
    // fazia os pagamentos avulsos serem completamente ignorados quando não havia orçamentos.
    const { data: lancsRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, valor_total')
      .eq('clinica_id', clinicaId)
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'receita')
      .order('created_at', { ascending: false })

    const lancsDB = (lancsRaw ?? []) as Array<{ id: string; descricao: string; valor_total: number }>

    // Separar lançamentos de orçamento (prefixo [orc:UUID]) dos avulsos
    for (const lanc of lancsDB) {
      const orcId = extrairOrcamentoIdDaDescricao(lanc.descricao)
      if (orcId) {
        lancPorOrcId[orcId] = lanc
      }
    }

    // Buscar parcelas pagas de todos os lançamentos (orçamentos + avulsos)
    const lancIds = lancsDB.map((l) => l.id)
    if (lancIds.length > 0) {
      const { data: parcelasRaw } = await supabase
        .from('financeiro_parcelas')
        .select('id, lancamento_id, valor, valor_pago, data_pagamento, status, forma_pagamento')
        .in('lancamento_id', lancIds)
        .order('data_pagamento', { ascending: false })

      const parcelasDB = (parcelasRaw ?? []) as Array<{
        id: string; lancamento_id: string; valor: number
        valor_pago: number | null; data_pagamento: string | null; status: string
        forma_pagamento: string | null
      }>

      // Rastrear quais lançamentos têm ao menos uma parcela NÃO-cancelada
      // (ou seja, tiveram atividade financeira real). Lançamentos onde TODAS
      // as parcelas são 'cancelado' são exercícios de treinamento / entradas
      // errôneas — não devem entrar no cálculo de saldo (caso Raiane).
      const lancComAtividade = new Set<string>()

      parcelasDB.forEach((p) => {
        if (p.status !== 'cancelado') {
          lancComAtividade.add(p.lancamento_id)
        }
        if (p.status === 'pago' || p.status === 'pago_parcial') {
          lancPagoMap[p.lancamento_id] = (lancPagoMap[p.lancamento_id] ?? 0) + (p.valor_pago ?? 0)
          if (p.data_pagamento) {
            const lanc = lancsDB.find((l) => l.id === p.lancamento_id)
            pagamentosColetados.push({
              id: p.id, lancamento_id: p.lancamento_id,
              descricao_lancamento: lanc?.descricao ?? '',
              valor_pago: p.valor_pago ?? p.valor,
              data_pagamento: p.data_pagamento,
              forma_pagamento: p.forma_pagamento ?? null,
            })
          }
        }
      })

      // Remover de lancPorOrcId os lançamentos puramente cancelados
      // (sem nenhuma parcela com status diferente de 'cancelado')
      for (const orcId of Object.keys(lancPorOrcId)) {
        const lancId = lancPorOrcId[orcId].id
        if (!lancComAtividade.has(lancId)) {
          delete lancPorOrcId[orcId]
        }
      }
    }

    // Cruzar orçamentos com saldo (usando mapa por ID do orçamento)
    let totalOrcado = 0
    let totalPago = 0

    const comSaldo: OrcamentoComSaldo[] = orcamentosCompletos.map((orc) => {
      const lanc = lancPorOrcId[orc.id]
      const valorPago = lanc ? (lancPagoMap[lanc.id] ?? 0) : 0
      if (orc.status === 'aprovado') {
        totalOrcado += orc.valor_total
        totalPago += valorPago
      }
      return {
        orcamento: orc,
        lancamentoId: lanc?.id ?? null,
        valor_pago: valorPago,
        valor_pendente: Math.max(0, orc.valor_total - valorPago),
      }
    })

    pagamentosColetados.sort((a, b) => b.data_pagamento.localeCompare(a.data_pagamento))

    setOrcamentos(orcamentosCompletos)
    setOrcamentosComSaldo(comSaldo)
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
    setOrcamentosComSaldo((prev) => prev.map((ocs) =>
      ocs.orcamento.id === id ? { ...ocs, orcamento: { ...ocs.orcamento, status } } : ocs
    ))
  }

  async function excluirOrcamento(id: string) {
    setExcluindo(true)
    const orc = orcamentos.find((o) => o.id === id)
    if (orc) {
      // FIX: buscar lançamento pelo prefixo UUID, não por valor_total
      const prefixo = ORC_PREFIX(orc.id)
      const { data: lancsVinculados } = await supabase
        .from('financeiro_lancamentos').select('id')
        .eq('clinica_id', clinicaId).eq('paciente_id', pacienteId)
        .ilike('descricao', `${prefixo}%`)

      if (lancsVinculados && lancsVinculados.length > 0) {
        const lancIds = (lancsVinculados as { id: string }[]).map((l) => l.id)
        await supabase.from('financeiro_parcelas').delete().in('lancamento_id', lancIds)
        await supabase.from('financeiro_lancamentos').delete().in('id', lancIds)
      }
    }
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
            <p className="text-xs text-gray-400 mt-0.5">Atualizado às {ultimaAtualizacao}</p>
          )}
        </div>
        <button onClick={carregar}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-blue-700"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className="text-base font-bold text-blue-600">{formatarMoeda(resumo.totalOrcado)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Aprovado</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className="text-base font-bold text-green-600">{formatarMoeda(resumo.totalPago)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Pago</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className={`text-base font-bold ${resumo.saldoDevedor > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatarMoeda(resumo.saldoDevedor)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Saldo</p>
        </div>
      </div>

      {/* Sub-abas */}
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

        {subAba === 'orcamentos' && (
          <button onClick={() => router.push(`/pacientes/${pacienteId}/orcamentos`)}
            className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white active:bg-blue-700 flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Novo Orçamento
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
              const ocs = orcamentosComSaldo.find((o) => o.orcamento.id === orc.id)
              const valorPago = ocs?.valor_pago ?? 0
              const saldo = ocs?.valor_pendente ?? orc.valor_total
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
                      {orc.status === 'aprovado' && saldo > 0 && (
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

                  {/* Barra de progresso (aprovado) */}
                  {orc.status === 'aprovado' && (
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
                  )}

                  {/* Ações — pendente */}
                  {orc.status === 'pendente' && (
                    <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
                      <button onClick={() => mudarStatusOrcamento(orc.id, 'aprovado')}
                        className="flex items-center justify-center gap-1 py-3 text-sm font-semibold text-green-700 active:bg-green-50"
                      ><Check className="h-4 w-4" /> Aprovar</button>
                      <button onClick={() => mudarStatusOrcamento(orc.id, 'recusado')}
                        className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-red-500 active:bg-red-50"
                      ><X className="h-4 w-4" /> Recusar</button>
                      <button
                        onClick={() => setExclusaoInfo({ tipo: 'orcamento', id: orc.id, mensagem: `Excluir orçamento de ${formatarMoeda(orc.valor_total)}?` })}
                        className="flex items-center justify-center py-3 text-gray-400 active:bg-gray-50"
                      ><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}

                  {/* Ações — aprovado */}
                  {orc.status === 'aprovado' && (
                    <div className="border-t border-gray-100 flex divide-x divide-gray-100">
                      {saldo > 0 ? (
                        <button
                          onClick={() => ocs && setModalOrcamento(ocs)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-blue-600 active:bg-blue-50"
                        >
                          <DollarSign className="h-4 w-4" /> Registrar Pagamento
                        </button>
                      ) : (
                        <div className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-green-600">
                          <Check className="h-4 w-4" /> Quitado
                        </div>
                      )}
                      <button
                        onClick={() => setExclusaoInfo({ tipo: 'orcamento', id: orc.id, mensagem: `Excluir orçamento de ${formatarMoeda(orc.valor_total)}?` })}
                        className="px-4 py-3 text-gray-400 active:bg-gray-50"
                      ><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}

                  {/* Ações — recusado */}
                  {orc.status === 'recusado' && (
                    <div className="border-t border-gray-100 flex divide-x divide-gray-100">
                      <button onClick={() => mudarStatusOrcamento(orc.id, 'pendente')}
                        className="flex-1 py-3 text-sm font-medium text-gray-500 active:bg-gray-50"
                      >Reabrir</button>
                      <button
                        onClick={() => setExclusaoInfo({ tipo: 'orcamento', id: orc.id, mensagem: `Excluir orçamento de ${formatarMoeda(orc.valor_total)}?` })}
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
              <p className="text-xs text-gray-400 mt-1">Nenhum pagamento de orçamento ou avulso registrado</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {pagamentos.map((p, idx) => (
                <div key={p.id}
                  className={`flex items-center gap-3 px-4 py-3 ${idx < pagamentos.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-lg">
                    {p.forma_pagamento ? (FORMA_EMOJI[p.forma_pagamento] ?? '💵') : '💵'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{formatarMoeda(p.valor_pago)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.forma_pagamento ? FORMA_LABEL[p.forma_pagamento] : 'Pagamento'}
                      {' • '}{formatarData(p.data_pagamento)}
                    </p>
                    {/* Mostra descrição do avulso (sem o prefixo [dentista]) */}
                    {!extrairOrcamentoIdDaDescricao(p.descricao_lancamento) && p.descricao_lancamento && (
                      <p className="text-xs text-blue-500 mt-0.5 truncate">
                        {p.descricao_lancamento.replace(/^\[[a-z]+\]\s*/, '')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setExclusaoInfo({
                      tipo: 'pagamento', id: p.id, lancamentoId: p.lancamento_id,
                      mensagem: `Excluir o pagamento de ${formatarMoeda(p.valor_pago)}? O saldo será revertido.`,
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
      {modalOrcamento && (
        <ModalRegistrarPagamento
          pacienteId={pacienteId}
          clinicaId={clinicaId}
          orcamentoComSaldo={modalOrcamento}
          onFechar={() => setModalOrcamento(null)}
          onSucesso={async () => { setModalOrcamento(null); await carregar() }}
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