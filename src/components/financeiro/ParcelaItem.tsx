// src/components/financeiro/ParcelaItem.tsx
'use client'

import { useState } from 'react'
import { Check, ChevronRight, AlertCircle } from 'lucide-react'
import { ParcelaComLancamento } from '@/lib/hooks/useFinanceiro'
import { formatarData, formatarMoeda } from '@/lib/utils'

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', className: 'text-blue-600 bg-blue-50' },
  pago: { label: 'Pago', className: 'text-emerald-600 bg-emerald-50' },
  pago_parcial: { label: 'Parcial', className: 'text-amber-600 bg-amber-50' },
  vencido: { label: 'Vencido', className: 'text-red-600 bg-red-50' },
} as const

interface Props {
  parcela: ParcelaComLancamento
  selecionado?: boolean
  modoSelecao?: boolean
  onSelecionar?: (id: string) => void
  onBaixar?: (parcelaId: string) => Promise<void>
  onClick?: () => void
  mostrarPaciente?: boolean
}

export function ParcelaItem({
  parcela,
  selecionado = false,
  modoSelecao = false,
  onSelecionar,
  onBaixar,
  onClick,
  mostrarPaciente = false,
}: Props) {
  const [baixando, setBaixando] = useState(false)
  const cfg = STATUS_CONFIG[parcela.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pendente
  const diasVencido = parcela.status === 'vencido'
    ? Math.floor((Date.now() - new Date(parcela.data_vencimento).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  async function handleBaixar(e: React.MouseEvent) {
    e.stopPropagation()
    if (!onBaixar) return
    setBaixando(true)
    await onBaixar(parcela.id)
    setBaixando(false)
  }

  const conteudo = (
    <div
      className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm transition-all
        ${modoSelecao ? 'cursor-pointer active:scale-[0.99]' : ''}
        ${selecionado ? 'ring-2 ring-blue-500' : ''}
      `}
      onClick={() => {
        if (modoSelecao && onSelecionar) onSelecionar(parcela.id)
        else if (onClick) onClick()
      }}
    >
      {/* Checkbox modo seleção */}
      {modoSelecao && (
        <div
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            selecionado ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
          }`}
        >
          {selecionado && <Check className="h-3 w-3 text-white" />}
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate text-sm">
              {mostrarPaciente && parcela.paciente_nome
                ? parcela.paciente_nome
                : parcela.lancamento?.descricao ?? 'Lançamento'}
            </p>
            {mostrarPaciente && (
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {parcela.lancamento?.descricao}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              Vence {formatarData(parcela.data_vencimento)}
              {parcela.numero > 1 && ` · Parcela ${parcela.numero}`}
            </p>
            {diasVencido > 0 && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-0.5">
                <AlertCircle className="h-3 w-3" />
                {diasVencido}d em atraso
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-sm font-bold text-gray-900">
              {formatarMoeda(parcela.valor - (parcela.valor_pago ?? 0))}
            </span>
            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${cfg.className}`}>
              {cfg.label}
            </span>
          </div>
        </div>
      </div>

      {/* Botão baixar (1 toque) */}
      {!modoSelecao && onBaixar && parcela.status !== 'pago' && (
        <button
          onClick={handleBaixar}
          disabled={baixando}
          className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-emerald-50 active:bg-emerald-100 disabled:opacity-50 transition-colors"
          title="Marcar como pago"
        >
          {baixando ? (
            <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          ) : (
            <Check className="h-4 w-4 text-emerald-600" />
          )}
        </button>
      )}

      {!modoSelecao && onClick && (
        <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
      )}
    </div>
  )

  return conteudo
}
