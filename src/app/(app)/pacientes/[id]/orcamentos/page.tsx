// src/app/(app)/pacientes/[id]/orcamentos/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, ChevronRight, Check, Clock, X, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { useProcedimentos } from '@/lib/hooks/useProcedimentos'
import { formatarMoeda, formatarData } from '@/lib/utils'

type StatusOrcamento = 'pendente' | 'aprovado' | 'recusado'

interface ItemOrcamento {
  id: string
  procedimento_id: string | null
  procedimento_nome: string
  descricao: string | null
  valor: number
}

interface Orcamento {
  id: string
  paciente_id: string
  clinica_id: string
  status: StatusOrcamento
  observacoes: string | null
  created_at: string
  itens: ItemOrcamento[]
  valor_total: number
}

export default function OrcamentosPage() {
  const { id: pacienteId } = useParams<{ id: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const { procedimentos } = useProcedimentos(clinicaId ?? '')

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [pacienteNome, setPacienteNome] = useState('')

  // Form novo orçamento
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<{ procedimento_id: string; descricao: string; valor: string }[]>([
    { procedimento_id: '', descricao: '', valor: '' }
  ])

  const carregar = useCallback(async () => {
    if (!clinicaId || !pacienteId) return
    setCarregando(true)
    const supabase = createClient()

    // Buscar nome do paciente
    const { data: pac } = await supabase
      .from('pacientes')
      .select('nome')
      .eq('id', pacienteId)
      .single()
    if (pac) setPacienteNome(pac.nome)

    // Buscar orçamentos
    const { data: orcs } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false })

    if (!orcs || orcs.length === 0) {
      setOrcamentos([])
      setCarregando(false)
      return
    }

    // Buscar itens
    const orcIds = orcs.map((o) => o.id)
    const { data: todosItens } = await supabase
      .from('orcamento_itens')
      .select('*')
      .in('orcamento_id', orcIds)

    const itensPorOrc: Record<string, ItemOrcamento[]> = {}
    todosItens?.forEach((item) => {
      if (!itensPorOrc[item.orcamento_id]) itensPorOrc[item.orcamento_id] = []
      itensPorOrc[item.orcamento_id].push({
        id: item.id,
        procedimento_id: item.procedimento_id,
        procedimento_nome: item.procedimento_nome,
        descricao: item.descricao,
        valor: item.valor,
      })
    })

    setOrcamentos(orcs.map((o) => ({
      ...o,
      itens: itensPorOrc[o.id] ?? [],
      valor_total: (itensPorOrc[o.id] ?? []).reduce((s, i) => s + i.valor, 0),
    })))
    setCarregando(false)
  }, [clinicaId, pacienteId])

  useEffect(() => { carregar() }, [carregar])

  function adicionarItem() {
    setItens([...itens, { procedimento_id: '', descricao: '', valor: '' }])
  }

  function removerItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx))
  }

  function atualizarItem(idx: number, campo: string, valor: string) {
    const novos = [...itens]
    novos[idx] = { ...novos[idx], [campo]: valor }
    // Auto-preencher valor ao selecionar procedimento
    if (campo === 'procedimento_id' && valor) {
      const proc = procedimentos.find((p) => p.id === valor)
      if (proc?.valor_padrao) {
        novos[idx].valor = proc.valor_padrao.toString()
      }
      novos[idx].descricao = proc?.nome ?? ''
    }
    setItens(novos)
  }

  async function salvarOrcamento() {
    if (!clinicaId) return
    const itensFiltrados = itens.filter((i) => i.descricao.trim() && parseFloat(i.valor) > 0)
    if (itensFiltrados.length === 0) return
    setSalvando(true)

    const supabase = createClient()
    const { data: orc } = await supabase
      .from('orcamentos')
      .insert({ paciente_id: pacienteId, clinica_id: clinicaId, status: 'pendente', observacoes: observacoes || null })
      .select()
      .single()

    if (orc) {
      await supabase.from('orcamento_itens').insert(
        itensFiltrados.map((i) => ({
          orcamento_id: orc.id,
          procedimento_id: i.procedimento_id || null,
          procedimento_nome: i.descricao.trim(),
          descricao: null,
          valor: parseFloat(i.valor),
        }))
      )
    }

    setSalvando(false)
    setCriando(false)
    setItens([{ procedimento_id: '', descricao: '', valor: '' }])
    setObservacoes('')
    carregar()
  }

  async function mudarStatus(id: string, status: StatusOrcamento) {
    const supabase = createClient()
    await supabase.from('orcamentos').update({ status }).eq('id', id)
    setOrcamentos((prev) => prev.map((o) => o.id === id ? { ...o, status } : o))
  }

  async function deletarOrcamento(id: string) {
    if (!confirm('Excluir este orçamento?')) return
    const supabase = createClient()
    await supabase.from('orcamento_itens').delete().eq('orcamento_id', id)
    await supabase.from('orcamentos').delete().eq('id', id)
    setOrcamentos((prev) => prev.filter((o) => o.id !== id))
  }

  async function aprovarEGerarCobranca(orc: Orcamento) {
    if (!clinicaId) return
    await mudarStatus(orc.id, 'aprovado')
    // Navegar para o financeiro/lancamento com dados pré-preenchidos
    const params = new URLSearchParams({
      paciente_id: pacienteId,
      descricao: `Orçamento aprovado`,
      valor: orc.valor_total.toString(),
    })
    router.push(`/financeiro/lancamento?${params.toString()}`)
  }

  const badgeStatus = (status: StatusOrcamento) => {
    const map = {
      pendente: { label: 'Pendente', bg: '#FEF3C7', color: '#92400E', icon: Clock },
      aprovado: { label: 'Aprovado', bg: '#D1FAE5', color: '#065F46', icon: Check },
      recusado: { label: 'Recusado', bg: '#FEE2E2', color: '#991B1B', icon: X },
    }
    return map[status]
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl active:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900">Orçamentos</h1>
          {pacienteNome && <p className="text-xs text-gray-500 truncate">{pacienteNome}</p>}
        </div>
        <button
          onClick={() => setCriando(true)}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Novo
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
        {carregando ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
          ))
        ) : orcamentos.length === 0 && !criando ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-medium text-gray-500">Nenhum orçamento ainda</p>
            <p className="text-sm text-gray-400 mt-1">Toque em "Novo" para criar</p>
          </div>
        ) : (
          orcamentos.map((orc) => {
            const badge = badgeStatus(orc.status)
            const BadgeIcon = badge.icon
            return (
              <div key={orc.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Cabeçalho */}
                <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-400">{formatarData(orc.created_at.split('T')[0])}</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{formatarMoeda(orc.valor_total)}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: badge.bg, color: badge.color }}>
                    <BadgeIcon className="h-3 w-3" />
                    {badge.label}
                  </span>
                </div>

                {/* Itens */}
                <div className="px-4 pb-3 space-y-1">
                  {orc.itens.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700 truncate flex-1">{item.procedimento_nome}</span>
                      <span className="text-gray-500 ml-2 flex-shrink-0">{formatarMoeda(item.valor)}</span>
                    </div>
                  ))}
                  {orc.observacoes && (
                    <p className="text-xs text-gray-400 mt-2 italic">{orc.observacoes}</p>
                  )}
                </div>

                {/* Ações */}
                {orc.status === 'pendente' && (
                  <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
                    <button
                      onClick={() => aprovarEGerarCobranca(orc)}
                      className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-green-700 active:bg-green-50"
                    >
                      <Check className="h-4 w-4" />
                      Aprovar
                    </button>
                    <button
                      onClick={() => mudarStatus(orc.id, 'recusado')}
                      className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-red-600 active:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      Recusar
                    </button>
                    <button
                      onClick={() => deletarOrcamento(orc.id)}
                      className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-400 active:bg-gray-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                )}
                {orc.status !== 'pendente' && (
                  <div className="border-t border-gray-100 flex">
                    {orc.status === 'aprovado' && (
                      <button
                        onClick={() => router.push(`/financeiro/lancamento?paciente_id=${pacienteId}&valor=${orc.valor_total}&descricao=Orçamento`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-blue-600 active:bg-blue-50"
                      >
                        Gerar cobrança
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deletarOrcamento(orc.id)}
                      className="px-4 py-3 text-sm font-medium text-gray-400 active:bg-gray-50 border-l border-gray-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Formulário novo orçamento */}
        {criando && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Novo Orçamento</h3>
            </div>

            <div className="p-4 space-y-3">
              {itens.map((item, idx) => (
                <div key={idx} className="space-y-2 pb-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">Item {idx + 1}</p>
                    {itens.length > 1 && (
                      <button onClick={() => removerItem(idx)} className="text-red-400">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <select
                    value={item.procedimento_id}
                    onChange={(e) => atualizarItem(idx, 'procedimento_id', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="">Selecionar procedimento...</option>
                    {procedimentos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Descrição do serviço"
                    value={item.descricao}
                    onChange={(e) => atualizarItem(idx, 'descricao', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />

                  <input
                    type="number"
                    placeholder="Valor (R$)"
                    value={item.valor}
                    onChange={(e) => atualizarItem(idx, 'valor', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  />
                </div>
              ))}

              <button
                onClick={adicionarItem}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 active:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Adicionar item
              </button>

              <textarea
                placeholder="Observações (opcional)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none"
              />

              {/* Total */}
              <div className="flex justify-between items-center font-semibold text-gray-900 pt-1">
                <span>Total</span>
                <span>{formatarMoeda(
                  itens.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0)
                )}</span>
              </div>
            </div>

            <div className="border-t border-gray-100 grid grid-cols-2 divide-x divide-gray-100">
              <button
                onClick={() => { setCriando(false); setItens([{ procedimento_id: '', descricao: '', valor: '' }]) }}
                className="py-3.5 text-sm font-medium text-gray-500 active:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarOrcamento}
                disabled={salvando}
                className="py-3.5 text-sm font-semibold text-blue-600 active:bg-blue-50 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}