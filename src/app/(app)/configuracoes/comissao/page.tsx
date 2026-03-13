// src/app/(app)/configuracoes/comissao/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Percent, Info } from 'lucide-react'
import { useComissaoStore } from '@/store/comissao.store'
import { formatarMoeda } from '@/lib/utils'

export default function ComissaoPage() {
  const router = useRouter()
  const { percentualComissao, setPercentualComissao } = useComissaoStore()

  const [percentual, setPercentual] = useState(percentualComissao.toString())
  const [salvo, setSalvo] = useState(false)

  function salvar() {
    const num = parseFloat(percentual)
    if (isNaN(num) || num < 0 || num > 100) return
    setPercentualComissao(num)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  const pct = parseFloat(percentual) || 0

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">Comissão da Secretária</h1>
      </div>

      <div className="px-4 py-6 space-y-4">

        {/* Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex gap-3">
          <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            A comissão é calculada sobre o valor <strong>recebido</strong> nos atendimentos e pagamentos
            realizados pelo <strong>Drº Eduardo Cortelleti</strong>. Configure o percentual abaixo.
          </p>
        </div>

        {/* Dentistas envolvidos */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dentistas da clínica</p>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700">RH</div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Drª Rosiele Hoffmann</p>
              <p className="text-xs text-gray-400">Sem comissão</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">EC</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Drº Eduardo Cortelleti</p>
              <p className="text-xs text-emerald-600 font-medium">Gera comissão de {pct}%</p>
            </div>
            <span className="text-sm font-bold text-emerald-700">{pct}%</span>
          </div>
        </div>

        {/* Percentual */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Percentual de comissão
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-lg font-bold text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Preview de cálculo */}
          {pct > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Exemplo de cálculo</p>
              {[500, 1000, 2000, 5000].map(ex => (
                <div key={ex} className="flex justify-between text-sm">
                  <span className="text-gray-500">Dr. Eduardo recebe {formatarMoeda(ex)}</span>
                  <span className="font-semibold text-emerald-600">
                    → comissão {formatarMoeda(ex * pct / 100)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={salvar}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold transition-colors ${
            salvo ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white active:bg-blue-700'
          }`}
        >
          <Save className="h-4 w-4" />
          {salvo ? '✓ Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
