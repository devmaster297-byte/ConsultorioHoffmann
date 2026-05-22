// src/app/(app)/financeiro/inadimplentes/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useInadimplentes } from '@/lib/hooks/useFinanceiro'
import { formatarMoeda, iniciais } from '@/lib/utils'

export default function InadimplentesPage() {
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const { inadimplentes, carregando } = useInadimplentes(clinicaId ?? '')

  const totalDevedor = inadimplentes.reduce((acc, i) => acc + i.total_vencido, 0)

  if (carregando) {
    return (
      <div className="flex flex-col min-h-full bg-gray-50">
        <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="font-semibold text-gray-900">Saldo em Aberto</h1>
        </div>
        <div className="px-4 py-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="flex-1 font-semibold text-gray-900">Saldo em Aberto</h1>
        <span className="text-sm text-gray-400">{inadimplentes.length} paciente{inadimplentes.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Resumo total */}
      {inadimplentes.length > 0 && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex justify-between items-center">
          <p className="text-sm text-red-500 font-medium">Total a receber</p>
          <p className="text-xl font-bold text-red-600">{formatarMoeda(totalDevedor)}</p>
        </div>
      )}

      {/* Lista de pacientes */}
      <div className="flex-1 px-4 py-4 space-y-2">
        {inadimplentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="font-semibold text-gray-700">Tudo em dia!</p>
            <p className="text-sm text-gray-400 mt-1">Nenhum paciente com saldo em aberto</p>
          </div>
        ) : (
          <>
            {inadimplentes.map((inadimplente) => (
              <Link
                key={inadimplente.paciente_id}
                href={`/pacientes/${inadimplente.paciente_id}`}
                className="flex items-center gap-3 bg-white rounded-2xl px-4 py-4 shadow-sm active:bg-gray-50 transition-colors"
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 font-semibold text-sm">
                  {iniciais(inadimplente.paciente_nome)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{inadimplente.paciente_nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {inadimplente.parcelas.length} parcela{inadimplente.parcelas.length !== 1 ? 's' : ''} em aberto
                  </p>
                </div>

                {/* Saldo + seta */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <p className="text-sm font-bold text-red-600">{formatarMoeda(inadimplente.total_vencido)}</p>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </div>
              </Link>
            ))}

            <p className="text-center text-xs text-gray-400 pt-2">
              Toque em um paciente para ver o histórico completo
            </p>
          </>
        )}
      </div>
    </div>
  )
}