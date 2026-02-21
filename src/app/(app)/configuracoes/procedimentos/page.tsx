// src/app/(app)/configuracoes/procedimentos/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, ToggleLeft, ToggleRight, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { useProcedimentos } from '@/lib/hooks/useProcedimentos'
import { Procedimento } from '@/lib/supabase/types'
import { formatarMoeda } from '@/lib/utils'

export default function ProcedimentosPage() {
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const { procedimentos, carregando } = useProcedimentos(clinicaId ?? '')
  const [lista, setLista] = useState<Procedimento[] | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Usar lista local se houver (após edições) ou a do hook
  const dados = lista ?? procedimentos

  async function salvarNovo() {
    if (!novoNome.trim() || !clinicaId) return
    setSalvando(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('procedimentos')
      .insert({
        clinica_id: clinicaId,
        nome: novoNome.trim(),
        valor_padrao: novoValor ? parseFloat(novoValor) : null,
      })
      .select()
      .single()

    if (data) {
      setLista([...dados, data])
      setNovoNome('')
      setNovoValor('')
      setAdicionando(false)
    }
    setSalvando(false)
  }

  async function salvarEdicao(id: string, nome: string, valor: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('procedimentos')
      .update({
        nome: nome.trim(),
        valor_padrao: valor ? parseFloat(valor) : null,
      })
      .eq('id', id)
      .select()
      .single()

    if (data) {
      setLista(dados.map((p) => (p.id === id ? data : p)))
    }
    setEditandoId(null)
  }

  async function toggleAtivo(proc: Procedimento) {
    const supabase = createClient()
    const { data } = await supabase
      .from('procedimentos')
      .update({ ativo: !proc.ativo })
      .eq('id', proc.id)
      .select()
      .single()

    if (data) {
      setLista(dados.map((p) => (p.id === proc.id ? data : p)))
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="flex-1 font-semibold text-gray-900">Procedimentos</h1>
        <button
          onClick={() => setAdicionando(true)}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Novo
        </button>
      </div>

      <div className="flex-1 px-4 py-4">
        {/* Formulário de novo procedimento */}
        {adicionando && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Novo procedimento</p>
            <input
              type="text"
              placeholder="Nome do procedimento"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="Valor padrão (opcional)"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={salvarNovo}
                disabled={!novoNome.trim() || salvando}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => { setAdicionando(false); setNovoNome(''); setNovoValor('') }}
                className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {carregando ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : dados.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            Nenhum procedimento cadastrado
          </div>
        ) : (
          <div className="space-y-2">
            {dados.map((proc) => (
              <ProcedimentoRow
                key={proc.id}
                proc={proc}
                editando={editandoId === proc.id}
                onEditar={() => setEditandoId(proc.id)}
                onSalvar={(nome, valor) => salvarEdicao(proc.id, nome, valor)}
                onCancelar={() => setEditandoId(null)}
                onToggle={() => toggleAtivo(proc)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProcedimentoRow({
  proc,
  editando,
  onEditar,
  onSalvar,
  onCancelar,
  onToggle,
}: {
  proc: Procedimento
  editando: boolean
  onEditar: () => void
  onSalvar: (nome: string, valor: string) => void
  onCancelar: () => void
  onToggle: () => void
}) {
  const [nome, setNome] = useState(proc.nome)
  const [valor, setValor] = useState(proc.valor_padrao?.toString() ?? '')

  if (editando) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSalvar(nome, valor)}
            className="flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
          >
            <Check className="h-4 w-4" /> Salvar
          </button>
          <button
            onClick={onCancelar}
            className="flex items-center gap-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-600"
          >
            <X className="h-4 w-4" /> Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm ${!proc.ativo ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{proc.nome}</p>
        {proc.valor_padrao != null && (
          <p className="text-sm text-gray-400 mt-0.5">{formatarMoeda(proc.valor_padrao)}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onEditar} className="p-2 rounded-full hover:bg-gray-100">
          <Pencil className="h-4 w-4 text-gray-400" />
        </button>
        <button onClick={onToggle} className="p-2 rounded-full hover:bg-gray-100">
          {proc.ativo
            ? <ToggleRight className="h-5 w-5 text-blue-500" />
            : <ToggleLeft className="h-5 w-5 text-gray-300" />}
        </button>
      </div>
    </div>
  )
}
