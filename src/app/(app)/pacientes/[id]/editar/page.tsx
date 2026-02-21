// src/app/(app)/pacientes/[id]/editar/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { Paciente } from '@/lib/supabase/types'
import { FotoUploader } from '@/components/shared/FotoUploader'
import { formatarTelefone, formatarCPF } from '@/lib/utils'

const schema = z.object({
  nome: z.string().min(2, 'Nome muito curto'),
  telefone: z.string().optional().or(z.literal('')),
  cpf: z.string().optional().or(z.literal('')),
  data_nascimento: z.string().optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  observacoes: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export default function EditarPacientePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!id) return
    async function carregar() {
      const supabase = createClient()
      const { data } = await supabase.from('pacientes').select('*').eq('id', id).single()
      if (!data) {
        router.back()
        return
      }
      setPaciente(data)
      setFotoUrl(data.foto_url)
      reset({
        nome: data.nome,
        telefone: data.telefone ?? '',
        cpf: data.cpf ?? '',
        data_nascimento: data.data_nascimento ?? '',
        email: data.email ?? '',
        observacoes: data.observacoes ?? '',
      })
      setCarregando(false)
    }
    carregar()
  }, [id, reset, router])

  async function onSubmit(data: FormData) {
    setSalvando(true)
    setErro(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('pacientes')
      .update({
        nome: data.nome,
        telefone: data.telefone || null,
        cpf: data.cpf || null,
        data_nascimento: data.data_nascimento || null,
        email: data.email || null,
        observacoes: data.observacoes || null,
      })
      .eq('id', id)

    if (error) {
      setErro('Erro ao salvar. Tente novamente.')
      setSalvando(false)
      return
    }

    router.push(`/pacientes/${id}`)
  }

  async function excluirPaciente() {
    setExcluindo(true)
    const supabase = createClient()
    await supabase.from('pacientes').delete().eq('id', id)
    router.push('/pacientes')
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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="flex-1 font-semibold text-gray-900">Editar Paciente</h1>
        <button
          onClick={() => setConfirmarExclusao(true)}
          className="p-2 rounded-full hover:bg-red-50 active:bg-red-100"
        >
          <Trash2 className="h-4 w-4 text-red-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 px-4 py-6 space-y-4">
        {/* Foto */}
        {paciente && clinicaId && (
          <div className="flex justify-center mb-2">
            <FotoUploader
              clinicaId={clinicaId}
              pacienteId={id}
              fotoAtual={fotoUrl}
              onAtualizar={setFotoUrl}
            />
          </div>
        )}

        {/* Campos obrigatórios */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Dados principais
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
            <input
              {...register('nome')}
              type="text"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {errors.nome && <p className="mt-1 text-xs text-red-500">{errors.nome.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              {...register('telefone')}
              type="tel"
              onChange={(e) => setValue('telefone', formatarTelefone(e.target.value))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Campos opcionais */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Informações adicionais
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
            <input
              {...register('cpf')}
              type="text"
              maxLength={14}
              onChange={(e) => setValue('cpf', formatarCPF(e.target.value))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data de nascimento
            </label>
            <input
              {...register('data_nascimento')}
              type="date"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              {...register('email')}
              type="email"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              {...register('observacoes')}
              rows={3}
              placeholder="Alergias, convênio, observações gerais..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
        </div>

        {erro && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
        )}

        <div className="pb-8">
          <button
            type="submit"
            disabled={salvando}
            className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60 active:bg-blue-700 transition-colors"
          >
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>

      {/* Modal confirmação exclusão */}
      {confirmarExclusao && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="w-full bg-white rounded-t-2xl p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 text-center">Excluir paciente?</h2>
            <p className="text-sm text-gray-500 text-center">
              Todo o histórico, radiografias e cobranças vinculadas serão removidos permanentemente.
            </p>
            <button
              onClick={excluirPaciente}
              disabled={excluindo}
              className="w-full rounded-xl bg-red-600 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {excluindo ? 'Excluindo...' : 'Sim, excluir paciente'}
            </button>
            <button
              onClick={() => setConfirmarExclusao(false)}
              className="w-full rounded-xl bg-gray-100 py-3.5 text-sm font-medium text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
