// src/app/(app)/configuracoes/comissao/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Percent, Info, ArrowRight } from 'lucide-react'
import { useComissaoStore } from '@/store/comissao.store'
import { formatarMoeda } from '@/lib/utils'

export default function ComissaoPage() {
  const router = useRouter()
  const {
    percentualRepasse,
    percentualSecretaria,
    setPercentualRepasse,
    setPercentualSecretaria,
  } = useComissaoStore()

  const [repasse, setRepasse]         = useState(percentualRepasse.toString())
  const [secretaria, setSecretaria]   = useState(percentualSecretaria.toString())
  const [salvo, setSalvo]             = useState(false)

  function salvar() {
    const r = parseFloat(repasse)
    const s = parseFloat(secretaria)
    if (isNaN(r) || r < 0 || r > 100) return
    if (isNaN(s) || s < 0 || s > 100) return
    setPercentualRepasse(r)
    setPercentualSecretaria(s)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  const r = parseFloat(repasse)   || 0
  const s = parseFloat(secretaria) || 0

  // Exemplos de cálculo
  const exemplos = [500, 1000, 2000, 5000]

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">Modelo Financeiro</h1>
      </div>

      <div className="px-4 py-6 space-y-4">

        {/* Explicação do modelo */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-4 space-y-3">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-blue-800">Como funciona</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-blue-700 flex-wrap">
            <span className="bg-white rounded-lg px-2 py-1 font-semibold border border-blue-200">Dr. Eduardo recebe X</span>
            <ArrowRight className="h-3 w-3 flex-shrink-0" />
            <span className="bg-white rounded-lg px-2 py-1 font-semibold border border-blue-200">Paga {r}% à Dra. Rosiele</span>
            <ArrowRight className="h-3 w-3 flex-shrink-0" />
            <span className="bg-white rounded-lg px-2 py-1 font-semibold border border-blue-200">Patricia recebe {s}% desse repasse</span>
          </div>
        </div>

        {/* Dentistas */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dentistas</p>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700 flex-shrink-0">RH</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Drª Rosiele Hoffmann</p>
              <p className="text-xs text-gray-500">Proprietária da clínica</p>
            </div>
            <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">Titular</span>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">EC</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Drº Eduardo Cortelleti</p>
              <p className="text-xs text-gray-500">Repassa {r}% à Dra. Rosiele</p>
            </div>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{r}%</span>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 flex-shrink-0">P</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Patricia (Secretária)</p>
              <p className="text-xs text-gray-500">{s}% sobre o repasse do Dr. Eduardo</p>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">{s}% do repasse</span>
          </div>
        </div>

        {/* Configuração dos percentuais */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Percentuais</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repasse do Dr. Eduardo para a Dra. Rosiele
            </label>
            <div className="relative">
              <input
                type="number" min="0" max="100" step="0.5"
                value={repasse}
                onChange={(e) => setRepasse(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-lg font-bold text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comissão da Patricia sobre o repasse
            </label>
            <div className="relative">
              <input
                type="number" min="0" max="100" step="0.5"
                value={secretaria}
                onChange={(e) => setSecretaria(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-lg font-bold text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Equivale a {(r * s / 100).toFixed(2)}% do faturamento bruto do Dr. Eduardo
            </p>
          </div>
        </div>

        {/* Tabela de exemplos */}
        {r > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Simulação</p>
            <div className="space-y-0 divide-y divide-gray-50">
              {/* Cabeçalho */}
              <div className="grid grid-cols-4 pb-2">
                <p className="text-xs text-gray-400 font-medium">Dr. Eduardo</p>
                <p className="text-xs text-gray-400 font-medium text-right">Repasse ({r}%)</p>
                <p className="text-xs text-emerald-600 font-medium text-right">Patricia ({s}%)</p>
                <p className="text-xs text-purple-600 font-medium text-right">Rosiele</p>
              </div>
              {exemplos.map(ex => {
                const rep   = ex * r / 100
                const pat   = rep * s / 100
                const ros   = rep - pat
                return (
                  <div key={ex} className="grid grid-cols-4 py-2.5">
                    <p className="text-sm font-semibold text-gray-800">{formatarMoeda(ex)}</p>
                    <p className="text-sm text-blue-700 text-right">{formatarMoeda(rep)}</p>
                    <p className="text-sm text-emerald-600 text-right font-semibold">{formatarMoeda(pat)}</p>
                    <p className="text-sm text-purple-600 text-right">{formatarMoeda(ros)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button
          onClick={salvar}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold transition-colors ${
            salvo ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white active:bg-blue-700'
          }`}
        >
          <Save className="h-4 w-4" />
          {salvo ? '✓ Salvo!' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  )
}
