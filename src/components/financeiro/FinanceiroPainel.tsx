// src/components/financeiro/FinanceiroPainel.tsx
'use client'

import { TrendingUp, Clock, TrendingDown, Wallet } from 'lucide-react'
import { MetricasMensais } from '@/lib/hooks/useFinanceiro'
import { formatarMoeda } from '@/lib/utils'

interface Props {
  metricas: MetricasMensais
  carregando: boolean
  mes: string // "2025-02"
  onMesAnterior: () => void
  onMesProximo: () => void
}

function CardMetrica({
  label,
  valor,
  icon: Icon,
  cor,
  carregando,
}: {
  label: string
  valor: number
  icon: React.ElementType
  cor: 'green' | 'blue' | 'red' | 'gray'
  carregando: boolean
}) {
  const corConfig = {
    green: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
    red: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-500' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'text-gray-500' },
  }[cor]

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className={`inline-flex items-center justify-center h-9 w-9 rounded-xl ${corConfig.bg} mb-3`}>
        <Icon className={`h-5 w-5 ${corConfig.icon}`} />
      </div>
      {carregando ? (
        <div className="h-6 w-24 bg-gray-100 rounded animate-pulse mb-1" />
      ) : (
        <p className={`text-lg font-bold ${corConfig.text} leading-tight`}>
          {formatarMoeda(valor)}
        </p>
      )}
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function labelMes(mes: string) {
  const [ano, mesNum] = mes.split('-')
  return new Date(Number(ano), Number(mesNum) - 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

export function FinanceiroPainel({
  metricas,
  carregando,
  mes,
  onMesAnterior,
  onMesProximo,
}: Props) {
  const agora = new Date().toISOString().slice(0, 7)
  const eMesAtual = mes === agora

  return (
    <div>
      {/* Seletor de mês */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onMesAnterior}
          className="p-2 rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
        >
          ‹
        </button>
        <h2 className="text-sm font-semibold text-gray-700 capitalize">
          {labelMes(mes)}
          {eMesAtual && (
            <span className="ml-2 text-xs font-normal text-blue-500">• Atual</span>
          )}
        </h2>
        <button
          onClick={onMesProximo}
          className={`p-2 rounded-full transition-colors ${
            eMesAtual ? 'text-gray-300 cursor-default' : 'bg-gray-100 active:bg-gray-200'
          }`}
          disabled={eMesAtual}
        >
          ›
        </button>
      </div>

      {/* 4 cards */}
      <div className="grid grid-cols-2 gap-3">
        <CardMetrica
          label="Recebido"
          valor={metricas.totalRecebido}
          icon={TrendingUp}
          cor="green"
          carregando={carregando}
        />
        <CardMetrica
          label="Pendente"
          valor={metricas.totalPendente}
          icon={Clock}
          cor="blue"
          carregando={carregando}
        />
        <CardMetrica
          label="Despesas"
          valor={metricas.totalDespesas}
          icon={TrendingDown}
          cor="red"
          carregando={carregando}
        />
        <CardMetrica
          label="Saldo"
          valor={metricas.saldo}
          icon={Wallet}
          cor={metricas.saldo >= 0 ? 'green' : 'red'}
          carregando={carregando}
        />
      </div>
    </div>
  )
}
