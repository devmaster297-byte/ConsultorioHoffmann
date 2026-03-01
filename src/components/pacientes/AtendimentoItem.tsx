// src/components/pacientes/AtendimentoItem.tsx
'use client'

import Link from 'next/link'
import { ChevronRight, Scan } from 'lucide-react'
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

const STATUS_CONFIG: Record<StatusPagamento, { label: string; dot: string; badge: string }> = {
  pago:    { label: 'Pago',      dot: 'bg-emerald-400', badge: 'text-emerald-700 bg-emerald-50' },
  parcial: { label: 'Parcial',   dot: 'bg-amber-400',   badge: 'text-amber-700 bg-amber-50'     },
  aberto:  { label: 'Em aberto', dot: 'bg-red-400',     badge: 'text-red-700 bg-red-50'         },
}

export function AtendimentoItem({
  id, pacienteId, data, procedimento, descricao,
  valor, statusPagamento, totalRadiografias = 0,
}: AtendimentoItemProps) {
  const cfg = STATUS_CONFIG[statusPagamento]

  return (
    <Link
      href={`/pacientes/${pacienteId}/atendimento/${id}`}
      className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
    >
      {/* Dot de status */}
      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-gray-900 truncate text-sm">
            {procedimento ?? descricao ?? 'Atendimento'}
          </p>
          {valor != null && (
            <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
              {formatarMoeda(valor)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1">
          <p className="text-xs text-gray-400">{formatarData(data)}</p>

          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
            {cfg.label}
          </span>

          {totalRadiografias > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400 ml-auto">
              <Scan className="h-3 w-3" />
              {totalRadiografias}
            </span>
          )}
        </div>

        {/* Descrição adicional (quando tem procedimento E descrição) */}
        {procedimento && descricao && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{descricao}</p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
    </Link>
  )
}