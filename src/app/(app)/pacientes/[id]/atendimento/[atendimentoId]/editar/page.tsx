// src/app/(app)/pacientes/[id]/atendimento/[atendimentoId]/editar/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { useProcedimentos } from '@/lib/hooks/useProcedimentos'

const DENTISTAS_FIXOS = [
  { id: 'rosieli', nome: 'Drª Rosieli Hoffmann'   },
  { id: 'eduardo', nome: 'Drº Eduardo Cortelleti' },
  { id: 'pamela',  nome: 'Drª Pamela Bolsoni'     },
]

export default function EditarAtendimentoPage() {
  const { id: pacienteId, atendimentoId } = useParams<{ id: string; atendimentoId: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const { procedimentos } = useProcedimentos(clinicaId ?? '')

  const dentistas = DENTISTAS_FIXOS
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const hoje = new Date().toISOString().split('T')[0]
  const [data, setData] = useState('')
  const [procedimentoId, setProcedimentoId] = useState('')
  const [dentistaId, setDentistaId] = useState('')
  const [descricao, setDescricao] = useState('')

  useEffect(() => {
    if (!clinicaId || !atendimentoId) return

    // Carregar atendimento atual
    supabase
      .from('atendimentos')
      .select('data_atendimento, procedimento_id, dentista_id, descricao')
      .eq('id', atendimentoId)
      .single()
      .then(({ data }) => {
        if (data) {
          setData(data.data_atendimento ?? '')
          setProcedimentoId(data.procedimento_id ?? '')
          // Detectar dentista: se dentista_id existe é Rosieli, senão checar prefixo na descricao
          const desc = data.descricao ?? ''
          const prefMatch = desc.match(/^\[([a-z]+)\]/)
          if (prefMatch && DENTISTAS_FIXOS.some(d => d.id === prefMatch[1])) {
            setDentistaId(prefMatch[1])
            setDescricao(desc.replace(/^\[[a-z]+\]\s*/, ''))
          } else if (data.dentista_id) {
            setDentistaId('rosieli')
            setDescricao(desc)
          } else {
            setDentistaId('')
            setDescricao(desc)
          }
        }
        setCarregando(false)
      })
  }, [clinicaId, atendimentoId])

  async function salvar() {
    if (!data) { setErro('Informe a data'); return }
    if (!dentistaId) { setErro('Selecione o dentista'); return }
    setSalvando(true)
    setErro(null)

    // Resolver dentista_id real para Rosieli, null para externos
    let dentistaIdFinal: string | null = null
    if (dentistaId === 'rosieli' && clinicaId) {
      const { data: dr } = await supabase
        .from('usuarios').select('id').eq('clinica_id', clinicaId)
        .ilike('nome', '%Rosieli%').limit(1).single()
      dentistaIdFinal = (dr as { id: string } | null)?.id ?? null
    }
    const descFinal = dentistaId !== 'rosieli' && dentistaId
      ? `[${dentistaId}]${descricao ? ' ' + descricao : ''}`
      : (descricao || null)

    const { error } = await supabase
      .from('atendimentos')
      .update({
        data_atendimento: data,
        procedimento_id: procedimentoId || null,
        dentista_id: dentistaIdFinal,
        descricao: descFinal,
      })
      .eq('id', atendimentoId)

    if (error) {
      setErro('Erro ao salvar. Tente novamente.')
      setSalvando(false)
      return
    }

    router.push(`/pacientes/${pacienteId}/atendimento/${atendimentoId}`)
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">Editar Atendimento</h1>
      </div>

      <div className="flex-1 px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
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
          </div>

          {/* Procedimento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Procedimento</label>
            <div className="relative">
              <select
                value={procedimentoId}
                onChange={(e) => setProcedimentoId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none bg-white"
              >
                <option value="">Nenhum</option>
                {procedimentos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={5}
              placeholder="Dente 16, anestesia aplicada, próxima consulta..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {erro && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
        )}

        <div className="pb-6">
          <button
            onClick={salvar}
            disabled={salvando || !dentistaId}
            className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60 active:bg-blue-700"
          >
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
