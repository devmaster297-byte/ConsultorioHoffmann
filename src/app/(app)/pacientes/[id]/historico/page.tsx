// src/app/(app)/pacientes/[id]/historico/page.tsx
// Página dedicada de histórico de um paciente (acessada via aba ou link direto)
'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useAtendimentos } from '@/lib/hooks/useAtendimentos'
import { AtendimentoItem } from '@/components/pacientes/AtendimentoItem'

export default function HistoricoPacientePage() {
  const { id: pacienteId } = useParams<{ id: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const { atendimentos, carregando } = useAtendimentos(pacienteId, clinicaId ?? '')

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="flex-1 font-semibold text-gray-900">Histórico</h1>
        <Link
          href={`/pacientes/${pacienteId}/atendimento/novo`}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Novo
        </Link>
      </div>

      <div className="flex-1 px-4 py-4">
        {carregando ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : atendimentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-gray-400">Nenhum atendimento registrado</p>
            <Link
              href={`/pacientes/${pacienteId}/atendimento/novo`}
              className="mt-3 text-sm text-blue-600 font-medium"
            >
              Registrar primeiro atendimento →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {atendimentos.map((a) => (
              <AtendimentoItem
                key={a.id}
                id={a.id}
                pacienteId={pacienteId}
                data={a.data_atendimento}
                procedimento={a.procedimento_nome}
                descricao={a.descricao}
                valor={a.valor_total}
                statusPagamento={a.status_pagamento}
                totalRadiografias={a.total_radiografias}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
