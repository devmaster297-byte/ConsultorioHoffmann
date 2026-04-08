// src/app/(app)/financeiro/avulso/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ClipboardList, X } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { formatarMoeda } from '@/lib/utils'

// ─── Constantes ───────────────────────────────────────────────────────────────

const DENTISTAS = [
  { key: 'rosieli', nome: 'Drª Rosieli Hoffmann',   initials: 'RH', cor: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'eduardo', nome: 'Drº Eduardo Corteletti', initials: 'EC', cor: 'bg-blue-100 text-blue-700 border-blue-200'       },
  { key: 'pamela',  nome: 'Drª Pamela Bolsoni',     initials: 'PB', cor: 'bg-rose-100 text-rose-700 border-rose-200'      },
]

const FORMAS = [
  { id: 'pix',            label: 'PIX',           emoji: '📱' },
  { id: 'dinheiro',       label: 'Dinheiro',      emoji: '💵' },
  { id: 'cartao_credito', label: 'Crédito',       emoji: '💳' },
  { id: 'cartao_debito',  label: 'Débito',        emoji: '💳' },
  { id: 'transferencia',  label: 'Transferência', emoji: '🏦' },
  { id: 'boleto',         label: 'Boleto',        emoji: '📄' },
]

// ─── Modal: Registrar Atendimento? ────────────────────────────────────────────

function ModalAtendimento({
  pacienteNome,
  descricaoPagamento,
  valor,
  dentistaNome,
  onConfirmar,
  onPular,
}: {
  pacienteNome: string
  descricaoPagamento: string
  valor: number
  dentistaNome: string
  onConfirmar: (procedimentoId: string | null, observacoes: string) => void
  onPular: () => void
}) {
  const { clinicaId } = useAuthStore()
  const [procedimentos, setProcedimentos] = useState<{ id: string; nome: string }[]>([])
  const [procedimentoId, setProcedimentoId] = useState('')
  const [observacoes, setObservacoes] = useState(descricaoPagamento)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!clinicaId) return
    supabase
      .from('procedimentos')
      .select('id, nome')
      .eq('clinica_id', clinicaId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setProcedimentos((data ?? []) as { id: string; nome: string }[]))
  }, [clinicaId])

  function handleConfirmar() {
    setSalvando(true)
    onConfirmar(procedimentoId || null, observacoes)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="w-full bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 60px)' }}>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Registrar Atendimento?</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Pagamento de {formatarMoeda(valor)} registrado para <strong>{pacienteNome}</strong>
            </p>
          </div>
          <button onClick={onPular} className="p-1 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Info resumida */}
          <div className="bg-emerald-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">✓</div>
            <div>
              <p className="text-xs font-semibold text-emerald-800">Pagamento salvo com sucesso</p>
              <p className="text-xs text-emerald-600">{dentistaNome} · {formatarMoeda(valor)}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Deseja também criar um <strong>registro de atendimento</strong> para <strong>{pacienteNome}</strong>
            no histórico do paciente?
          </p>

          {/* Procedimento */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Procedimento <span className="font-normal normal-case text-gray-400">(opcional)</span>
            </label>
            <div className="relative">
              <select
                value={procedimentoId}
                onChange={(e) => setProcedimentoId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Selecione o procedimento...</option>
                {procedimentos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Anotações sobre o atendimento..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Botões */}
        <div
          className="flex-shrink-0 px-5 pt-3 pb-8 border-t border-gray-100 space-y-2 bg-white"
        >
          <button
            onClick={handleConfirmar}
            disabled={salvando}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white disabled:opacity-50 active:bg-blue-700"
          >
            <ClipboardList className="h-4 w-4" />
            {salvando ? 'Salvando...' : 'Sim, registrar atendimento'}
          </button>
          <button
            onClick={onPular}
            className="w-full rounded-2xl bg-gray-100 py-3.5 text-sm font-medium text-gray-600 active:bg-gray-200"
          >
            Não, apenas o pagamento
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PagamentoAvulsoPage() {
  const router = useRouter()
  const { clinicaId, usuario } = useAuthStore()
  const hoje = new Date().toISOString().split('T')[0]

  // Campos do pagamento
  const [descricao, setDescricao]   = useState('')
  const [valor, setValor]           = useState('')
  const [forma, setForma]           = useState('pix')
  const [data, setData]             = useState(hoje)
  const [dentistaKey, setDentistaKey] = useState<string>('rosiele')

  // Busca de paciente
  const [pacienteNome, setPacienteNome]     = useState('')
  const [pacienteId, setPacienteId]         = useState<string | null>(null)
  const [sugestoes, setSugestoes]           = useState<{ id: string; nome: string }[]>([])
  const [buscandoPac, setBuscandoPac]       = useState(false)

  // Controle de fluxo
  const [salvando, setSalvando]             = useState(false)
  const [erro, setErro]                     = useState<string | null>(null)
  const [mostrarModalAtend, setMostrarModalAtend] = useState(false)
  const [lancamentoIdSalvo, setLancamentoIdSalvo] = useState<string | null>(null)

  async function buscarPaciente(nome: string) {
    setPacienteNome(nome)
    setPacienteId(null)
    if (nome.length < 2) { setSugestoes([]); return }
    setBuscandoPac(true)
    const { data } = await supabase
      .from('pacientes')
      .select('id, nome')
      .eq('clinica_id', clinicaId)
      .ilike('nome', `%${nome}%`)
      .limit(6)
    setSugestoes((data ?? []) as { id: string; nome: string }[])
    setBuscandoPac(false)
  }

  function selecionarPaciente(p: { id: string; nome: string }) {
    setPacienteId(p.id)
    setPacienteNome(p.nome)
    setSugestoes([])
  }

  function limparPaciente() {
    setPacienteId(null)
    setPacienteNome('')
    setSugestoes([])
  }

  // ── Etapa 1: salvar pagamento ──────────────────────────────────────────────

  async function salvar() {
    const valorNum = parseFloat(valor)
    if (!descricao.trim())       { setErro('Informe uma descrição'); return }
    if (!valorNum || valorNum <= 0) { setErro('Informe um valor válido'); return }
    if (!clinicaId)              { setErro('Sessão expirada'); return }

    setSalvando(true)
    setErro(null)

    const descFinal = `[${dentistaKey}] ${descricao.trim()}`

    const { data: lanc, error: lancErr } = await supabase
      .from('financeiro_lancamentos')
      .insert({
        clinica_id:  clinicaId,
        paciente_id: pacienteId ?? null,
        tipo:        'receita',
        descricao:   descFinal,
        valor_total: valorNum,
        num_parcelas: 1,
      })
      .select('id')
      .single()

    if (lancErr || !lanc) {
      setErro('Erro ao criar lançamento')
      setSalvando(false)
      return
    }

    const lancId = (lanc as { id: string }).id

    const { error: parErr } = await supabase
      .from('financeiro_parcelas')
      .insert({
        lancamento_id:  lancId,
        clinica_id:     clinicaId,
        numero:         1,
        valor:          valorNum,
        valor_pago:     valorNum,
        data_vencimento: data,
        data_pagamento: data,
        status:         'pago',
      })

    if (parErr) {
      await supabase.from('financeiro_lancamentos').delete().eq('id', lancId)
      setErro('Erro ao registrar pagamento')
      setSalvando(false)
      return
    }

    setLancamentoIdSalvo(lancId)
    setSalvando(false)

    // Se tem paciente vinculado → pergunta sobre atendimento
    if (pacienteId) {
      setMostrarModalAtend(true)
    } else {
      router.push('/financeiro')
    }
  }

  // ── Etapa 2a: criar atendimento e navegar ──────────────────────────────────

  async function criarAtendimento(procedimentoId: string | null, observacoes: string) {
    if (!pacienteId || !clinicaId) { router.push('/financeiro'); return }

    // Rosieli está no banco de usuarios; Eduardo e Pamela são externos (null)
    let dentistaId: string | null = null
    if (dentistaKey === 'rosieli' && clinicaId) {
      const { data: dr } = await supabase
        .from('usuarios').select('id').eq('clinica_id', clinicaId)
        .ilike('nome', '%Rosieli%').limit(1).single()
      dentistaId = (dr as { id: string } | null)?.id ?? null
    }

    await supabase.from('atendimentos').insert({
      clinica_id:       clinicaId,
      paciente_id:      pacienteId,
      dentista_id:      dentistaId,
      data_atendimento: data,
      procedimento_id:  procedimentoId ?? null,
      descricao:        observacoes || descricao.trim() || null,
    })

    router.push(`/pacientes/${pacienteId}`)
  }

  // ── Etapa 2b: pular atendimento ────────────────────────────────────────────

  function pularAtendimento() {
    setMostrarModalAtend(false)
    router.push('/financeiro')
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const valorNum = parseFloat(valor) || 0
  const dentistaSel = DENTISTAS.find(d => d.key === dentistaKey)

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="font-semibold text-gray-900">Pagamento Avulso</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manutenção, consulta rápida ou outro serviço</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 pb-10">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">

          {/* Paciente */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Paciente <span className="text-gray-400 font-normal normal-case">(opcional — gera atendimento automaticamente)</span>
            </label>
            {pacienteId ? (
              /* Paciente selecionado */
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">
                  {pacienteNome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <p className="flex-1 text-sm font-semibold text-emerald-800">{pacienteNome}</p>
                <button onClick={limparPaciente} className="text-emerald-500 hover:text-emerald-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={pacienteNome}
                  onChange={(e) => buscarPaciente(e.target.value)}
                  placeholder="Digite o nome para buscar..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                />
                {buscandoPac && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">buscando...</span>
                )}
                {sugestoes.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20">
                    {sugestoes.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selecionarPaciente(p)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                      >
                        {p.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {pacienteId && (
              <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />
                Após salvar, você poderá registrar o atendimento no histórico
              </p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Descrição *
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Manutenção aparelho, consulta de retorno..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Valor */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Valor (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-lg font-bold text-gray-900 focus:border-blue-500 focus:outline-none"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Dentista */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Dentista
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DENTISTAS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDentistaKey(d.key)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-3 transition-all ${
                    dentistaKey === d.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    dentistaKey === d.key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {d.initials}
                  </div>
                  <span className={`text-xs leading-tight text-left ${
                    dentistaKey === d.key ? 'font-semibold text-blue-800' : 'text-gray-600'
                  }`}>
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
            <div className="grid grid-cols-3 gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setForma(f.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 transition-all ${
                    forma === f.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-lg">{f.emoji}</span>
                  <span className={`text-xs font-medium ${forma === f.id ? 'text-blue-700' : 'text-gray-600'}`}>
                    {f.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
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
        </div>

        {/* Preview */}
        {valorNum > 0 && (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Resumo</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">
                {descricao || '—'} · {dentistaSel?.initials}
                {pacienteId ? ` · ${pacienteNome}` : ''}
              </p>
            </div>
            <p className="text-lg font-bold text-emerald-600">{formatarMoeda(valorNum)}</p>
          </div>
        )}

        {erro && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
        )}

        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white disabled:opacity-50 active:bg-blue-700"
        >
          {salvando ? 'Salvando...' : '✓ Registrar Pagamento'}
        </button>
      </div>

      {/* Modal pós-pagamento */}
      {mostrarModalAtend && pacienteId && (
        <ModalAtendimento
          pacienteNome={pacienteNome}
          descricaoPagamento={descricao}
          valor={parseFloat(valor) || 0}
          dentistaNome={dentistaSel?.nome ?? ''}
          onConfirmar={criarAtendimento}
          onPular={pularAtendimento}
        />
      )}
    </div>
  )
}
