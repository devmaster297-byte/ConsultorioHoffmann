// src/components/pacientes/AtendimentoItem.tsx
'use client'

import Link from 'next/link'
import { ChevronRight, Scan } from 'lucide-react'
import { formatarData } from '@/lib/utils'

interface AtendimentoItemProps {
  id: string
  pacienteId: string
  data: string
  procedimento: string | null
  descricao: string | null
  totalRadiografias?: number
  dentistaNome?: string | null
}

export function AtendimentoItem({
  id, pacienteId, data, procedimento, descricao,
  totalRadiografias = 0, dentistaNome,
}: AtendimentoItemProps) {
  const titulo = procedimento ?? descricao ?? 'Atendimento'

  return (
    <Link
      href={`/pacientes/${pacienteId}/atendimento/${id}`}
      className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
    >
      {/* Indicador lateral */}
      <div className="h-8 w-1 rounded-full bg-blue-200 flex-shrink-0" />

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate text-sm">{titulo}</p>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <p className="text-xs text-gray-400">{formatarData(data)}</p>

          {dentistaNome && (
            <p className="text-xs text-gray-400 truncate">Dr(a). {dentistaNome}</p>
          )}

          {/* Descrição quando título já é procedimento */}
          {procedimento && descricao && (
            <p className="text-xs text-gray-400 truncate">{descricao}</p>
          )}
        </div>
      </div>

      {/* Raio-X badge */}
      {totalRadiografias > 0 && (
        <span className="flex items-center gap-0.5 text-xs text-indigo-500 flex-shrink-0">
          <Scan className="h-3 w-3" />
          {totalRadiografias}
        </span>
      )}

      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
    </Link>
  )
}
