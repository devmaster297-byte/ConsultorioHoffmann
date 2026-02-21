// src/app/(app)/financeiro/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useFinanceiro, baixarParcela } from '@/lib/hooks/useFinanceiro'
import { FinanceiroPainel } from '@/components/financeiro/FinanceiroPainel'
import { ParcelaItem } from '@/components/financeiro/ParcelaItem'

export default function FinanceiroPage() {
  const { clinicaId } = useAuthStore()
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))

  const { metricas, proximosVencimentos, carregando, recarregar } = useFinanceiro(
    clinicaId ?? '',
    mes
  )

  function mesAnterior() {
    const [ano, mesNum] = mes.split('-').map(Number)
    const d = new Date(ano, mesNum - 2) // -2 porque month é 0-based
    setMes(d.toISOString().slice(0, 7))
  }

  function mesProximo() {
    const agora = new Date().toISOString().slice(0, 7)
    if (mes >= agora) return
    const [ano, mesNum] = mes.split('-').map(Number)
    const d = new Date(ano, mesNum)
    setMes(d.toISOString().slice(0, 7))
  }

  async function handleBaixarParcela(parcelaId: string) {
    const ok = await baixarParcela(parcelaId)
    if (ok) recarregar()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-gray-900">Financeiro</h1>
          <Link
            href="/financeiro/lancamento"
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white active:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Lançar
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
        {/* Painel de métricas */}
        <FinanceiroPainel
          metricas={metricas}
          carregando={carregando}
          mes={mes}
          onMesAnterior={mesAnterior}
          onMesProximo={mesProximo}
        />

        {/* Botão inadimplentes em destaque */}
        <Link
          href="/financeiro/inadimplentes"
          className="flex items-center justify-between bg-red-50 border border-red-100 rounded-2xl px-4 py-4 active:bg-red-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-red-700 text-sm">Inadimplentes</p>
              <p className="text-xs text-red-400">Ver parcelas vencidas</p>
            </div>
          </div>
          <span className="text-red-400 text-lg">›</span>
        </Link>

        {/* Próximos vencimentos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Próximos 7 dias</h2>
            <Link
              href="/financeiro/parcelas"
              className="text-xs text-blue-600 font-medium"
            >
              Ver tudo →
            </Link>
          </div>

          {carregando ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : proximosVencimentos.length === 0 ? (
            <div className="bg-white rounded-xl px-4 py-6 shadow-sm text-center">
              <p className="text-sm text-gray-400">Nenhum vencimento nos próximos 7 dias</p>
            </div>
          ) : (
            <div className="space-y-2">
              {proximosVencimentos.map((p) => (
                <ParcelaItem
                  key={p.id}
                  parcela={p}
                  mostrarPaciente
                  onBaixar={handleBaixarParcela}
                  onClick={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
