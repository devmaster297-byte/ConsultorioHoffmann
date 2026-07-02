// src/app/(app)/pacientes/[id]/atendimento/novo/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, History } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'

interface Procedimento {
  id: string
  nome: string
}

// Dentistas fixos — não buscar do banco para evitar incluir a secretária
import { DENTISTAS } from '@/lib/dentistas'
// Mapeamento local para manter compatibilidade com a interface que usa .id
const DENTISTAS_FIXOS = DENTISTAS.map(d => ({ id: d.key, nome: d.nome }))

export default function NovoAtendimentoPage() {
  const { id: pacienteId } = useParams<{ id: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()

  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  const [dentistas, setDentistas] = useState<typeof DENTISTAS_FIXOS>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const hoje = new Date().toISOString().split('T')[0]
  const [data, setData] = useState(hoje)
  const [procedimentoId, setProcId] = useState('')
  const [dentistaId, setDentistaId] = useState('')
  const [descricao, setDescricao] = useState('')

  const ehPassado = data < hoje

  useEffect(() => {
    if (!clinicaId) return

    // Buscar procedimentos
    supabase
      .from('procedimentos')
      .select('id, nome')
      .eq('clinica_id', clinicaId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setProcedimentos(data ?? []))

    // Dentistas fixos da clínica (evita buscar Patricia pelo perfil admin)
    setDentistas(DENTISTAS_FIXOS)
  }, [clinicaId])

  async function salvar() {
    if (!data) { setErro('Informe a data'); return }
    if (!dentistaId) { setErro('Selecione o dentista'); return }
    if (!clinicaId) { setErro('Sessão expirada, recarregue'); return }
    setSalvando(true)
    setErro(null)

    // Para dentistas externos (Eduardo, Pamela), dentista_id fica null
    // Para Rosieli, busca o ID real na tabela usuarios
    let dentistaIdFinal: string | null = null
    if (dentistaId === 'rosieli' && clinicaId) {
      const { data: dr } = await supabase
        .from('usuarios').select('id').eq('clinica_id', clinicaId)
        .ilike('nome', '%Rosieli%').limit(1).single()
      dentistaIdFinal = (dr as { id: string } | null)?.id ?? null
    }
    // Guardar o nome do dentista na descrição como prefixo se for externo
    const descFinal = dentistaId !== 'rosieli' && dentistaId
      ? `[${dentistaId}]${descricao ? ' ' + descricao : ''}`
      : (descricao || null)

    const { error } = await supabase
      .from('atendimentos')
      .insert({
        clinica_id:       clinicaId,
        paciente_id:      pacienteId,
        dentista_id:      dentistaIdFinal,
        data_atendimento: data,
        procedimento_id:  procedimentoId || null,
        descricao:        descFinal,
        valor_total:      null,
      })

    if (error) {
      setErro(`Erro ao salvar: ${error.message}`)
      setSalvando(false)
      return
    }

    router.push(`/pacientes/${pacienteId}`)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="font-semibold text-gray-900">Novo Atendimento</h1>
          {ehPassado && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
              <History className="h-3 w-3" /> Registro histórico
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data do atendimento
              <span className="ml-1 text-xs text-gray-400 font-normal">(pode ser data passada)</span>
            </label>
            <input
              type="date" value={data} max={hoje}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Dentista */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dentista <span className="text-red-400">*</span>
            </label>
            {dentistas.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Carregando dentistas...</p>
            ) : (
              <div className="flex flex-col gap-2">
                {dentistas.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDentistaId(d.id)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${
                      dentistaId === d.id
                        ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      dentistaId === d.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {d.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="flex-1 text-left">{d.nome}</span>
                    {dentistaId === d.id && (
                      <span className="text-blue-500 text-lg leading-none">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Procedimento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Procedimento
            </label>
            <div className="relative">
              <select
                value={procedimentoId}
                onChange={(e) => setProcId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Selecione...</option>
                {procedimentos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Dente 16, anestesia aplicada, próxima consulta..."
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Aviso informativo */}
        <div className="bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100">
          <p className="text-xs text-blue-700 leading-relaxed">
            💡 Para registrar valores e pagamentos, use a aba <strong>Financeiro</strong> na ficha do paciente.
          </p>
        </div>

        {erro && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
        )}

        <div className="pb-8">
          <button
            onClick={salvar}
            disabled={salvando || !clinicaId || !dentistaId}
            className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white disabled:opacity-50 active:bg-blue-700"
          >
            {salvando ? 'Salvando...' : 'Salvar Atendimento'}
          </button>
        </div>
      </div>
    </div>
  )
}