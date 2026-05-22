// src/app/(app)/pacientes/[id]/radiografias/RadiografiasAba.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useRadiografias } from '@/lib/hooks/useRadiografias'
import { useAuthStore } from '@/store/auth.store'
import { RxGaleria } from '@/components/radiografias/RxGaleria'
import { RxUploader } from '@/components/radiografias/RxUploader'

export function RadiografiasAba({ pacienteId }: { pacienteId: string }) {
  const { clinicaId } = useAuthStore()
  const { radiografias, carregando, deletarRadiografia, atualizarAnotacao, uploadRadiografia } =
    useRadiografias(pacienteId, clinicaId ?? '')
  const [mostrarUploader, setMostrarUploader] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {radiografias.length} imagem{radiografias.length !== 1 ? 'ns' : ''}
        </p>
        <div className="flex items-center gap-2">
          {radiografias.length > 0 && (
            <Link href={`/radiografias?paciente=${pacienteId}`}
              className="text-xs text-blue-600 font-medium"
            >
              Ver todas →
            </Link>
          )}
          <button onClick={() => setMostrarUploader(true)}
            className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white active:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
      </div>

      <RxGaleria
        radiografias={radiografias}
        carregando={carregando}
        onAdicionarClick={() => setMostrarUploader(true)}
        onDeletar={deletarRadiografia}
        onAtualizarAnotacao={atualizarAnotacao}
      />

      {mostrarUploader && (
        <RxUploader
          onFechar={() => setMostrarUploader(false)}
          onUpload={uploadRadiografia}
        />
      )}
    </>
  )
}