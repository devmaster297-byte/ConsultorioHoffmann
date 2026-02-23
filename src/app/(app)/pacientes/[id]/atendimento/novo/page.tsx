// src/app/(app)/pacientes/[id]/atendimento/novo/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Calendar, ClipboardList, DollarSign, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

interface Procedimento {
  id: string
  nome: string
  valor_base: number
}

export default function NovoAtendimentoPage() {
  const { id: pacienteId } = useParams<{ id: string }>()
  const router = useRouter()
  const { clinicaId, usuario } = useAuthStore()

  const [carregando, setCarregando] = useState(false)
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  
  // Estado do formulário
  const [dataAtendimento, setDataAtendimento] = useState(new Date().toISOString().split('T')[0])
  const [procedimentoId, setProcedimentoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [dentistaId, setDentistaId] = useState(usuario?.id || '')

  useEffect(() => {
    async function carregarProcedimentos() {
      const supabase = createClient()
      const { data } = await supabase
        .from('procedimentos')
        .select('id, nome, valor_base')
        .eq('clinica_id', clinicaId)
        .order('nome')
      
      if (data) setProcedimentos(data)
    }

    if (clinicaId) carregarProcedimentos()
  }, [clinicaId])

  // Atualiza o valor total quando o procedimento é selecionado
  const handleProcedimentoChange = (id: string) => {
    setProcedimentoId(id)
    const proc = procedimentos.find(p => p.id === id)
    if (proc) setValorTotal(proc.valor_base.toString())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicaId || !pacienteId) return

    setCarregando(true)
    const supabase = createClient()

    const { data: novoAtendimento, error } = await supabase
      .from('atendimentos')
      .insert({
        clinica_id: clinicaId,
        paciente_id: pacienteId,
        dentista_id: dentistaId || null,
        procedimento_id: procedimentoId || null,
        data_atendimento: dataAtendimento,
        descricao: descricao || null,
        valor_total: valorTotal ? parseFloat(valorTotal) : null,
      })
      .select()
      .single()

    if (error) {
      alert('Erro ao salvar atendimento: ' + error.message)
      setCarregando(false)
      return
    }

    // Redireciona para a ficha do paciente (aba histórico)
    router.push(`/pacientes/${pacienteId}?tab=historico`)
    router.refresh()
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100 shadow-sm">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="flex-1 font-semibold text-gray-900">Novo Atendimento</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
          
          {/* Data */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <Calendar className="h-4 w-4 text-blue-500" />
              Data do Atendimento
            </label>
            <input
              type="date"
              required
              value={dataAtendimento}
              onChange={(e) => setDataAtendimento(e.target.value)}
              className="w-full rounded-xl border-gray-200 border p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Procedimento */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <ClipboardList className="h-4 w-4 text-blue-500" />
              Procedimento
            </label>
            <select
              value={procedimentoId}
              onChange={(e) => handleProcedimentoChange(e.target.value)}
              className="w-full rounded-xl border-gray-200 border p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Selecione um procedimento (opcional)</option>
              {procedimentos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          {/* Valor */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <DollarSign className="h-4 w-4 text-blue-500" />
              Valor do Atendimento
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              className="w-full rounded-xl border-gray-200 border p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Descrição/Observações */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <User className="h-4 w-4 text-blue-500" />
              Observações Clínicas
            </label>
            <textarea
              rows={4}
              placeholder="Descreva o que foi realizado..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full rounded-xl border-gray-200 border p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={carregando}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-transform disabled:opacity-70"
        >
          {carregando ? (
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save className="h-5 w-5" />
              Salvar Atendimento
            </>
          )}
        </button>
      </form>
    </div>
  )
}