// src/components/pacientes/AtendimentoItem.tsx
'use client'

import Link from 'next/link'
import { ChevronRight, Paperclip } from 'lucide-react'
import { formatarData, formatarMoeda } from '@/lib/utils'

type StatusPagamento = 'pago' | 'parcial' | 'aberto'

interface AtendimentoItemProps {
  id: string
  pacienteId: string
  data: string
  procedimento: string | null
  descricao: string | null
  valor: number | null
  statusPagamento: StatusPagamento
  totalRadiografias?: number
}

const statusConfig: Record<StatusPagamento, { label: string; className: string }> = {
  pago: { label: 'Pago', className: 'text-emerald-700 bg-emerald-50' },
  parcial: { label: 'Parcial', className: 'text-amber-700 bg-amber-50' },
  aberto: { label: 'Em aberto', className: 'text-red-700 bg-red-50' },
}

export function AtendimentoItem({
  id,
  pacienteId,
  data,
  procedimento,
  descricao,
  valor,
  statusPagamento,
  totalRadiografias = 0,
}: AtendimentoItemProps) {
  const { label, className } = statusConfig[statusPagamento]

  return (
    <Link
      href={`/pacientes/${pacienteId}/atendimento/${id}`}
      className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform"
    >
      {/* Linha da timeline */}
      <div className="flex flex-col items-center self-stretch">
        <div className="h-3 w-3 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
        <div className="flex-1 w-px bg-gray-100 mt-1" />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {procedimento ?? descricao ?? 'Atendimento'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{formatarData(data)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {valor != null && (
              <span className="text-sm font-semibold text-gray-700">
                {formatarMoeda(valor)}
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
              {label}
            </span>
          </div>
        </div>

        {/* Obs e raio-x */}
        <div className="flex items-center gap-3 mt-1.5">
          {descricao && procedimento && (
            <p className="text-xs text-gray-500 line-clamp-1 flex-1">{descricao}</p>
          )}
          {totalRadiografias > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400 flex-shrink-0">
              <Paperclip className="h-3 w-3" />
              {totalRadiografias} rx
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
    </Link>
  )
}
