// src/app/(app)/pacientes/[id]/radiografias/page.tsx
'use client'

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useRadiografias } from '@/lib/hooks/useRadiografias'
import { RxGaleria } from '@/components/radiografias/RxGaleria'
import { RxUploader } from '@/components/radiografias/RxUploader'

export default function RadiografiasPage() {
  const { id: pacienteId } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const atendimentoId = searchParams.get('atendimento') ?? undefined
  const { clinicaId } = useAuthStore()
  const [mostrarUploader, setMostrarUploader] = useState(false)

  const {
    radiografias,
    carregando,
    uploadRadiografia,
    deletarRadiografia,
    atualizarAnotacao,
  } = useRadiografias(pacienteId, clinicaId ?? '', atendimentoId)

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
        <h1 className="flex-1 font-semibold text-gray-900">
          Radiografias{atendimentoId ? ' do atendimento' : ''}
        </h1>
        <button
          onClick={() => setMostrarUploader(true)}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white active:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </div>

      {/* Galeria */}
      <div className="flex-1 px-4 py-4">
        <RxGaleria
          radiografias={radiografias}
          carregando={carregando}
          onAdicionarClick={() => setMostrarUploader(true)}
          onDeletar={deletarRadiografia}
          onAtualizarAnotacao={atualizarAnotacao}
        />
      </div>

      {/* Uploader */}
      {mostrarUploader && (
        <RxUploader
          onFechar={() => setMostrarUploader(false)}
          onUpload={uploadRadiografia}
          atendimentoId={atendimentoId}
        />
      )}
    </div>
  )
}
