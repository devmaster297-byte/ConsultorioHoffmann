// src/app/(app)/pacientes/[id]/orcamentos/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Check, Clock, X, Trash2, ChevronRight, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { formatarMoeda, formatarData } from '@/lib/utils'

type StatusOrcamento = 'pendente' | 'aprovado' | 'recusado'

interface Procedimento { id: string; nome: string; valor_padrao: number | null }
interface ItemForm { procedimento_id: string; descricao: string; valor: string }
interface ItemOrcamento {
  id: string
  procedimento_id: string | null
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

// Interfaces auxiliares para retorno do banco
interface OrcamentoDB {
  id: string
  status: StatusOrcamento
  observacoes: string | null
  created_at: string
  paciente_id: string
  clinica_id: string
}

interface ItemOrcamentoDB {
  id: string
  orcamento_id: string
  procedimento_id: string | null
  procedimento_nome: string
  valor: number
}

const STATUS_CONFIG = {
  pendente: { label: 'Pendente',  bg: '#FEF9C3', color: '#854D0E', Icon: Clock  },
  aprovado: { label: 'Aprovado',  bg: '#DCFCE7', color: '#166534', Icon: Check  },
  recusado: { label: 'Recusado', bg: '#FEE2E2', color: '#991B1B', Icon: X      },
}

export default function OrcamentosPage() {
  const { id: pacienteId } = useParams<{ id: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()

  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  const [orcamentos, setOrcamentos]       = useState<Orcamento[]>([])
  const [pacienteNome, setPacienteNome]   = useState('')
  const [carregando, setCarregando]       = useState(true)
  const [criando, setCriando]             = useState(false)
  const [salvando, setSalvando]           = useState(false)
  const [erroForm, setErroForm]           = useState<string | null>(null)

  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([
    { procedimento_id: '', descricao: '', valor: '' },
  ])

  // Carregar procedimentos corrigido com async/await e tipagem
  useEffect(() => {
    if (!clinicaId) return
    
    async function buscarProcedimentos() {
      const { data } = await createClient()
        .from('procedimentos')
        .select('id, nome, valor_padrao')
        .eq('clinica_id', clinicaId)
        .eq('ativo', true)
        .order('nome')
      
      setProcedimentos((data as Procedimento[]) ?? [])
    }

    buscarProcedimentos()
  }, [clinicaId])

  const carregar = useCallback(async () => {
    if (!clinicaId || !pacienteId) return
    setCarregando(true)
    const supabase = createClient()

    const { data: pac } = await supabase
      .from('pacientes').select('nome').eq('id', pacienteId).single()
    if (pac) setPacienteNome(pac.nome)

    // Tipando o retorno da query de orçamentos
    const { data: orcs, error } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false })

    const typedOrcs = orcs as OrcamentoDB[]

    if (error || !typedOrcs?.length) {
      setOrcamentos([])
      setCarregando(false)
      return
    }

    // Tipando o retorno da query de itens
    const { data: todosItens } = await supabase
      .from('orcamento_itens')
      .select('*')
      .in('orcamento_id', typedOrcs.map((o: OrcamentoDB) => o.id))

    const typedItens = todosItens as ItemOrcamentoDB[]

    const itensPorOrc: Record<string, ItemOrcamento[]> = {}
    typedItens?.forEach((item: ItemOrcamentoDB) => {
      if (!itensPorOrc[item.orcamento_id]) itensPorOrc[item.orcamento_id] = []
      itensPorOrc[item.orcamento_id].push({
        id: item.id,
        procedimento_id: item.procedimento_id,
        procedimento_nome: item.procedimento_nome,
        valor: Number(item.valor),
      })
    })

    setOrcamentos(typedOrcs.map((o: OrcamentoDB) => ({
      ...o,
      itens: itensPorOrc[o.id] ?? [],
      valor_total: (itensPorOrc[o.id] ?? []).reduce((s, i) => s + i.valor, 0),
    })))
    setCarregando(false)
  }, [clinicaId, pacienteId])

  useEffect(() => { carregar() }, [carregar])

  // --- Helpers do formulário ---
  function adicionarItem() {
    setItens(prev => [...prev, { procedimento_id: '', descricao: '', valor: '' }])
  }

  function removerItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function atualizarItem(idx: number, campo: keyof ItemForm, valor: string) {
    setItens(prev => {
      const novos = [...prev]
      novos[idx] = { ...novos[idx], [campo]: valor }
      if (campo === 'procedimento_id' && valor) {
        const proc = procedimentos.find(p => p.id === valor)
        if (proc) {
          novos[idx].descricao = proc.nome
          if (proc.valor_padrao) novos[idx].valor = proc.valor_padrao.toString()
        }
      }
      return novos
    })
  }

  const totalForm = itens.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0)

  async function salvar() {
    const validos = itens.filter(i => i.descricao.trim() && parseFloat(i.valor) > 0)
    if (validos.length === 0) {
      setErroForm('Adicione pelo menos um item com descrição e valor.')
      return
    }
    if (!clinicaId) return
    setSalvando(true)
    setErroForm(null)

    const supabase = createClient()
    const { data: orc, error } = await supabase
      .from('orcamentos')
      .insert({
        paciente_id: pacienteId,
        clinica_id:  clinicaId,
        status:      'pendente',
        observacoes: observacoes.trim() || null,
      })
      .select()
      .single()

    if (error || !orc) {
      setErroForm('Erro ao salvar orçamento. Tente novamente.')
      setSalvando(false)
      return
    }

    await supabase.from('orcamento_itens').insert(
      validos.map(i => ({
        orcamento_id:      orc.id,
        procedimento_id:   i.procedimento_id || null,
        procedimento_nome: i.descricao.trim(),
        valor:             parseFloat(i.valor),
      }))
    )

    setSalvando(false)
    setCriando(false)
    setItens([{ procedimento_id: '', descricao: '', valor: '' }])
    setObservacoes('')
    carregar()
  }

  function cancelarForm() {
    setCriando(false)
    setItens([{ procedimento_id: '', descricao: '', valor: '' }])
    setObservacoes('')
    setErroForm(null)
  }

  async function mudarStatus(id: string, status: StatusOrcamento) {
    await createClient().from('orcamentos').update({ status }).eq('id', id)
    setOrcamentos(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este orçamento?')) return
    const supabase = createClient()
    await supabase.from('orcamento_itens').delete().eq('orcamento_id', id)
    await supabase.from('orcamentos').delete().eq('id', id)
    setOrcamentos(prev => prev.filter(o => o.id !== id))
  }

  function gerarCobranca(orc: Orcamento) {
    const params = new URLSearchParams({
      paciente:   pacienteId as string,
      orcamento:  orc.id,
      valor:      orc.valor_total.toString(),
      descricao:  `Orçamento – ${orc.itens.map(i => i.procedimento_nome).join(', ')}`,
    })
    router.push(`/financeiro/lancamento?${params}`)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl active:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900">Orçamentos</h1>
          {pacienteNome && <p className="text-xs text-gray-400 truncate">{pacienteNome}</p>}
        </div>
        {!criando && (
          <button
            onClick={() => setCriando(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Novo
          </button>
        )}
      </div>

      <div className="flex-1 px-4 py-4 space-y-3 pb-8">
        {criando && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Novo Orçamento</h3>
            </div>

            <div className="p-4 space-y-4">
              {itens.map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Item {idx + 1}
                    </p>
                    {itens.length > 1 && (
                      <button onClick={() => removerItem(idx)} className="text-red-400 p-1">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {procedimentos.length > 0 && (
                    <select
                      value={item.procedimento_id}
                      onChange={e => atualizarItem(idx, 'procedimento_id', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white"
                    >
                      <option value="">Selecionar procedimento (opcional)</option>
                      {procedimentos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome}{p.valor_padrao ? ` — ${formatarMoeda(p.valor_padrao)}` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    type="text"
                    placeholder="Descrição *"
                    value={item.descricao}
                    onChange={e => atualizarItem(idx, 'descricao', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00 *"
                      value={item.valor}
                      onChange={e => atualizarItem(idx, 'valor', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-sm"
                    />
                  </div>

                  {idx < itens.length - 1 && <div className="border-b border-gray-100 pt-1" />}
                </div>
              ))}

              <button
                onClick={adicionarItem}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 active:bg-gray-50"
              >
                <Plus className="h-4 w-4" /> Adicionar item
              </button>

              <textarea
                placeholder="Observações (ex: validade 30 dias, inclui material)"
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none"
              />

              <div className="flex justify-between items-center font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
                <span>Total</span>
                <span className="text-blue-600">{formatarMoeda(totalForm)}</span>
              </div>

              {erroForm && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {erroForm}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 grid grid-cols-2 divide-x divide-gray-100">
              <button
                onClick={cancelarForm}
                className="py-3.5 text-sm font-medium text-gray-500 active:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando || totalForm === 0}
                className="py-3.5 text-sm font-bold text-blue-600 active:bg-blue-50 disabled:opacity-40"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {carregando ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
          ))
        ) : orcamentos.length === 0 && !criando ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-medium text-gray-500">Nenhum orçamento ainda</p>
            <p className="text-sm text-gray-400 mt-1">Toque em "Novo" para criar</p>
          </div>
        ) : (
          orcamentos.map(orc => {
            const cfg = STATUS_CONFIG[orc.status]
            return (
              <div key={orc.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400">
                      {formatarData(orc.created_at.split('T')[0])}
                    </p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">
                      {formatarMoeda(orc.valor_total)}
                    </p>
                  </div>
                  <span
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    <cfg.Icon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </div>

                <div className="px-4 pb-3 space-y-1.5 border-t border-gray-50 pt-2">
                  {orc.itens.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 truncate flex-1">{item.procedimento_nome}</span>
                      <span className="text-gray-500 ml-3 flex-shrink-0 font-medium">
                        {formatarMoeda(item.valor)}
                      </span>
                    </div>
                  ))}
                  {orc.observacoes && (
                    <p className="text-xs text-gray-400 italic pt-1">{orc.observacoes}</p>
                  )}
                </div>

                {orc.status === 'pendente' && (
                  <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
                    <button
                      onClick={async () => { await mudarStatus(orc.id, 'aprovado'); gerarCobranca({ ...orc, status: 'aprovado' }) }}
                      className="flex items-center justify-center gap-1 py-3 text-sm font-semibold text-green-700 active:bg-green-50"
                    >
                      <Check className="h-4 w-4" /> Aprovar
                    </button>
                    <button
                      onClick={() => mudarStatus(orc.id, 'recusado')}
                      className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-red-500 active:bg-red-50"
                    >
                      <X className="h-4 w-4" /> Recusar
                    </button>
                    <button
                      onClick={() => deletar(orc.id)}
                      className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-gray-400 active:bg-gray-50"
                    >
                      <Trash2 className="h-4 w-4" /> Excluir
                    </button>
                  </div>
                )}

                {orc.status === 'aprovado' && (
                  <div className="border-t border-gray-100 flex divide-x divide-gray-100">
                    <button
                      onClick={() => gerarCobranca(orc)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-blue-600 active:bg-blue-50"
                    >
                      Gerar cobrança <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deletar(orc.id)}
                      className="px-4 py-3 text-gray-400 active:bg-gray-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {orc.status === 'recusado' && (
                  <div className="border-t border-gray-100 flex divide-x divide-gray-100">
                    <button
                      onClick={() => mudarStatus(orc.id, 'pendente')}
                      className="flex-1 py-3 text-sm font-medium text-gray-500 active:bg-gray-50"
                    >
                      Reabrir
                    </button>
                    <button
                      onClick={() => deletar(orc.id)}
                      className="px-4 py-3 text-gray-400 active:bg-gray-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}