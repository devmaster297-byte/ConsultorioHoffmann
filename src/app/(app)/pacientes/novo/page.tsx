// src/app/(app)/pacientes/novo/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { FotoUploader } from '@/components/shared/FotoUploader'
import { formatarTelefone, formatarCPF } from '@/lib/utils'

const schema = z.object({
  nome: z.string().min(2, 'Nome muito curto').max(100),
  telefone: z.string().optional().or(z.literal('')),
  cpf: z.string().optional().or(z.literal('')),
  data_nascimento: z.string().optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  observacoes: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export default function NovoPacientePage() {
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const [salvando, setSalvando] = useState(false)
  const [mostrarCamposExtras, setMostrarCamposExtras] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Foto: salva após criar o paciente com ID real
  const [pacienteId, setPacienteId] = useState<string | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    if (!clinicaId) return
    setSalvando(true)
    setErro(null)

    const supabase = createClient()
    const { data: paciente, error } = await supabase
      .from('pacientes')
      .insert({
        clinica_id: clinicaId,
        nome: data.nome,
        telefone: data.telefone || null,
        cpf: data.cpf || null,
        data_nascimento: data.data_nascimento || null,
        email: data.email || null,
        observacoes: data.observacoes || null,
        foto_url: fotoUrl,
      })
      .select()
      .single()

    if (error || !paciente) {
      setErro('Erro ao salvar paciente. Tente novamente.')
      setSalvando(false)
      return
    }

    router.push(`/pacientes/${paciente.id}`)
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
        <h1 className="font-semibold text-gray-900">Novo Paciente</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 px-4 py-6">
        {/* Foto — usa um ID temporário; a foto real é salva aqui mesmo */}
        <div className="flex justify-center mb-6">
          {clinicaId && (
            <FotoUploader
              clinicaId={clinicaId}
              pacienteId={`temp-${Date.now()}`}
              fotoAtual={fotoUrl}
              onAtualizar={setFotoUrl}
            />
          )}
        </div>

        {/* Campos obrigatórios */}
        <div className="space-y-4 bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Obrigatório
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome completo
            </label>
            <input
              {...register('nome')}
              type="text"
              placeholder="Maria Silva"
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {errors.nome && (
              <p className="mt-1 text-xs text-red-500">{errors.nome.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefone / WhatsApp
            </label>
            <input
              {...register('telefone')}
              type="tel"
              placeholder="(27) 99999-9999"
              onChange={(e) => setValue('telefone', formatarTelefone(e.target.value))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Toggle campos opcionais */}
        <button
          type="button"
          onClick={() => setMostrarCamposExtras(!mostrarCamposExtras)}
          className="w-full mt-4 py-3 text-sm text-blue-600 font-medium"
        >
          {mostrarCamposExtras ? '− Menos detalhes' : '+ Adicionar mais detalhes'}
        </button>

        {mostrarCamposExtras && (
          <div className="space-y-4 bg-white rounded-2xl p-4 shadow-sm mt-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Opcional
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
              <input
                {...register('cpf')}
                type="text"
                placeholder="000.000.000-00"
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
                placeholder="maria@email.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                {...register('observacoes')}
                placeholder="Alergia a anestésico, convênio, etc."
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>
          </div>
        )}

        {erro && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {erro}
          </div>
        )}

        <div className="mt-6 pb-6">
          <button
            type="submit"
            disabled={salvando}
            className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60 active:bg-blue-700 transition-colors"
          >
            {salvando ? 'Salvando...' : 'Salvar Paciente'}
          </button>
        </div>
      </form>
    </div>
  )
}