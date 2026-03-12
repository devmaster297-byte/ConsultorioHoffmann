// src/app/(app)/pacientes/[id]/atendimento/[atendimentoId]/editar/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { useProcedimentos } from '@/lib/hooks/useProcedimentos'

const schema = z.object({
  data_atendimento: z.string().min(1, 'Data obrigatória'),
  procedimento_id: z.string().optional(),
  descricao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function EditarAtendimentoPage() {
  const { id: pacienteId, atendimentoId } = useParams<{ id: string; atendimentoId: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const { procedimentos } = useProcedimentos(clinicaId ?? '')
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const hoje = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!atendimentoId) return
    async function carregar() {
      const { data } = await supabase
        .from('atendimentos')
        .select('data_atendimento, procedimento_id, descricao')
        .eq('id', atendimentoId)
        .single()

      if (data) {
        reset({
          data_atendimento: data.data_atendimento,
          procedimento_id: data.procedimento_id ?? '',
          descricao: data.descricao ?? '',
        })
      }
      setCarregando(false)
    }
    carregar()
  }, [atendimentoId, reset])

  async function onSubmit(data: FormData) {
    setSalvando(true)
    setErro(null)

    const { error } = await supabase
      .from('atendimentos')
      .update({
        data_atendimento: data.data_atendimento,
        procedimento_id: data.procedimento_id || null,
        descricao: data.descricao || null,
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

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 px-4 py-6">
        <div className="space-y-4 bg-white rounded-2xl p-4 shadow-sm">

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data do atendimento
            </label>
            <input
              {...register('data_atendimento')}
              type="date"
              max={hoje}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {errors.data_atendimento && (
              <p className="mt-1 text-xs text-red-500">{errors.data_atendimento.message}</p>
            )}
          </div>

          {/* Procedimento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Procedimento</label>
            <div className="relative">
              <select
                {...register('procedimento_id')}
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
              {...register('descricao')}
              rows={5}
              placeholder="Dente 16, anestesia aplicada, próxima consulta..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
        </div>

        {erro && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
        )}

        <div className="mt-6 pb-6">
          <button
            type="submit"
            disabled={salvando}
            className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60 active:bg-blue-700 transition-colors"
          >
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
