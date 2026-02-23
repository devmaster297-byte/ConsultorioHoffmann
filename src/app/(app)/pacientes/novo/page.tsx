// src/app/(app)/pacientes/[id]/atendimento/novo/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'

interface Procedimento {
  id: string
  nome: string
  valor_padrao: number | null
}

export default function NovoAtendimentoPage() {
  const { id: pacienteId } = useParams<{ id: string }>()
  const router = useRouter()
  const { clinicaId, usuario } = useAuthStore()

  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [atendimentoSalvoId, setAtendimentoSalvoId] = useState<string | null>(null)

  const hoje = new Date().toISOString().split('T')[0]
  const [data, setData] = useState(hoje)
  const [procedimentoId, setProcedimentoId] = useState('')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')

  // Carregar procedimentos
  useEffect(() => {
    if (!clinicaId) return
    const supabase = createClient()
    supabase
      .from('procedimentos')
      .select('id, nome, valor_padrao')
      .eq('clinica_id', clinicaId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }: { data: Procedimento[] | null }) => setProcedimentos(data ?? []))
  }, [clinicaId])

  // Auto-preencher valor ao selecionar procedimento
  function handleProcedimento(id: string) {
    setProcedimentoId(id)
    const proc = procedimentos.find((p) => p.id === id)
    if (proc?.valor_padrao) setValor(proc.valor_padrao.toString())
  }

  async function salvar() {
    if (!data) { setErro('Informe a data'); return }
    if (!clinicaId) { setErro('Sessão expirada, recarregue a página'); return }
    setSalvando(true)
    setErro(null)

    const supabase = createClient()
    const { data: atend, error } = await supabase
      .from('atendimentos')
      .insert({
        clinica_id: clinicaId,
        paciente_id: pacienteId,
        dentista_id: usuario?.id ?? null,
        data_atendimento: data,
        procedimento_id: procedimentoId || null,
        descricao: descricao || null,
        valor_total: valor ? parseFloat(valor) : null,
      })
      .select()
      .single()

    setSalvando(false)

    if (error || !atend) {
      setErro(`Erro ao salvar: ${error?.message ?? 'tente novamente'}`)
      return
    }

    setAtendimentoSalvoId(atend.id)
  }

  // Tela pós-salvamento
  if (atendimentoSalvoId) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="px-4 py-4 bg-white border-b border-gray-100">
          <h1 className="font-semibold text-gray-900">Atendimento salvo ✓</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="text-center">
            <div className="text-4xl mb-3">💰</div>
            <h2 className="text-lg font-semibold text-gray-900">Lançar cobrança?</h2>
            <p className="text-sm text-gray-500 mt-1">Registrar o pagamento agora?</p>
          </div>
          <div className="w-full space-y-3">
            <button
              onClick={() => router.push(`/financeiro/lancamento?atendimento=${atendimentoSalvoId}&paciente=${pacienteId}`)}
              className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white"
            >
              Sim, lançar cobrança
            </button>
            <button
              onClick={() => router.push(`/pacientes/${pacienteId}`)}
              className="w-full rounded-2xl bg-gray-100 py-4 text-sm font-medium text-gray-700"
            >
              Não, registrar depois
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">Novo Atendimento</h1>
      </div>

      <div className="flex-1 px-4 py-6">
        <div className="space-y-4 bg-white rounded-2xl p-4 shadow-sm">

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Procedimento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Procedimento</label>
            <div className="relative">
              <select
                value={procedimentoId}
                onChange={(e) => handleProcedimento(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Selecione...</option>
                {procedimentos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}{p.valor_padrao ? ` — R$ ${p.valor_padrao.toFixed(2)}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Dente 16, anestesia aplicada..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {!clinicaId && (
          <div className="mt-4 rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
            Sessão carregando... aguarde um instante e tente novamente.
          </div>
        )}

        {erro && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
        )}

        <div className="mt-6 pb-8">
          <button
            onClick={salvar}
            disabled={salvando || !clinicaId}
            className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar Atendimento'}
          </button>
        </div>
      </div>
    </div>
  )
}