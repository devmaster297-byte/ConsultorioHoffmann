// src/app/(app)/pacientes/[id]/atendimento/[atendimentoId]/editar/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { useProcedimentos } from '@/lib/hooks/useProcedimentos'

const schema = z.object({
  data_atendimento: z.string().min(1),
  procedimento_id: z.string().optional(),
  descricao: z.string().optional(),
  valor_total: z.string().optional(),
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!atendimentoId) return
    async function carregar() {
      const supabase = createClient()
      const { data } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('id', atendimentoId)
        .single()

      if (data) {
        reset({
          data_atendimento: data.data_atendimento,
          procedimento_id: data.procedimento_id ?? '',
          descricao: data.descricao ?? '',
          valor_total: data.valor_total?.toString() ?? '',
        })
      }
      setCarregando(false)
    }
    carregar()
  }, [atendimentoId, reset])

  async function onSubmit(data: FormData) {
    setSalvando(true)
    setErro(null)
    const supabase = createClient()

    const { error } = await supabase
      .from('atendimentos')
      .update({
        data_atendimento: data.data_atendimento,
        procedimento_id: data.procedimento_id || null,
        descricao: data.descricao || null,
        valor_total: data.valor_total ? parseFloat(data.valor_total) : null,
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input
              {...register('data_atendimento')}
              type="date"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
              <input
                {...register('valor_total')}
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <textarea
              {...register('descricao')}
              rows={4}
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
