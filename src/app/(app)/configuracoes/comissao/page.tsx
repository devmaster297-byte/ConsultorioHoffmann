// src/app/(app)/configuracoes/comissao/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Percent, Info } from 'lucide-react'
import { useComissao } from '@/lib/hooks/useComissao'
import { formatarMoeda } from '@/lib/utils'

export default function ComissaoPage() {
  const router = useRouter()
  const { percentualRosieli, percentualPatricia, carregando, salvar } = useComissao()

  const [pRosieli,  setPRosiele]  = useState('')
  const [pPatricia, setPPatricia] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvo,    setSalvo]    = useState(false)
  const [erro,     setErro]     = useState('')

  // Preencher campos quando os valores carregarem do banco
  useEffect(() => {
    if (!carregando) {
      setPRosiele(percentualRosieli.toString())
      setPPatricia(percentualPatricia.toString())
    }
  }, [carregando, percentualRosieli, percentualPatricia])

  async function handleSalvar() {
    const r = parseFloat(pRosieli)
    const p = parseFloat(pPatricia)
    if (isNaN(r) || r < 0 || r > 100) return
    if (isNaN(p) || p < 0 || p > 100) return
    if (r + p > 100) return

    setSalvando(true)
    setErro('')
    const resultado = await salvar({ percentualRosieli: r, percentualPatricia: p })
    setSalvando(false)

    if (resultado.ok) {
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
    } else {
      setErro(resultado.erro ?? 'Erro ao salvar')
    }
  }

  const r = parseFloat(pRosieli)  || 0
  const p = parseFloat(pPatricia) || 0
  const eduardo = Math.max(0, 100 - r - p)
  const exemplos = [500, 1000, 2000, 5000]

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">Modelo Financeiro</h1>
      </div>

      <div className="px-4 py-6 space-y-4">

        {/* Explicação */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-4 space-y-2">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-blue-800">Como funciona</p>
          </div>
          <p className="text-xs text-blue-700 leading-relaxed">
            Sobre tudo que o <strong>Dr. Eduardo</strong> recebe: <strong>{r}%</strong> vai para a
            <strong> Drª Rosieli</strong> (uso do espaço) e <strong>{p}%</strong> vai para
            <strong> Patricia</strong> (comissão). Eduardo fica com os <strong>{eduardo.toFixed(1)}%</strong> restantes.
          </p>
        </div>

        {/* Distribuição visual */}
        {r + p > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Distribuição do bruto do Dr. Eduardo</p>
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              <div className="bg-blue-500 transition-all" style={{ width: `${eduardo}%` }} title={`Eduardo ${eduardo.toFixed(0)}%`} />
              <div className="bg-purple-500 transition-all" style={{ width: `${r}%` }} title={`Rosieli ${r}%`} />
              <div className="bg-emerald-500 transition-all" style={{ width: `${p}%` }} title={`Patricia ${p}%`} />
            </div>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" /> Eduardo {eduardo.toFixed(0)}%</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-purple-500 inline-block" /> Rosieli {r}%</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" /> Patricia {p}%</span>
            </div>
          </div>
        )}

        {/* Configuração */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Percentuais sobre o bruto do Dr. Eduardo</p>

          {/* Rosieli */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">RH</div>
              <label className="text-sm font-medium text-gray-700">Drª Rosieli Hoffmann</label>
            </div>
            <div className="relative">
              <input
                type="number" min="0" max="100" step="0.5"
                value={pRosieli}
                onChange={(e) => setPRosiele(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-lg font-bold text-gray-900 focus:border-purple-500 focus:outline-none"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Patricia */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">P</div>
              <label className="text-sm font-medium text-gray-700">Patricia (Secretária)</label>
            </div>
            <div className="relative">
              <input
                type="number" min="0" max="100" step="0.5"
                value={pPatricia}
                onChange={(e) => setPPatricia(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-lg font-bold text-gray-900 focus:border-emerald-500 focus:outline-none"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {r + p > 100 && (
            <p className="text-xs text-red-500">⚠️ A soma ultrapassa 100%. Ajuste os valores.</p>
          )}
          {erro && (
            <p className="text-xs text-red-500">⚠️ {erro}</p>
          )}
        </div>

        {/* Simulação */}
        {r + p > 0 && r + p <= 100 && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Simulação</p>
            <div className="space-y-0 divide-y divide-gray-50">
              <div className="grid grid-cols-4 pb-2">
                <p className="text-xs text-gray-400 font-medium">Dr. Eduardo</p>
                <p className="text-xs text-blue-600 font-medium text-right">Eduardo</p>
                <p className="text-xs text-purple-600 font-medium text-right">Rosieli</p>
                <p className="text-xs text-emerald-600 font-medium text-right">Patricia</p>
              </div>
              {exemplos.map(ex => {
                const ros = ex * r / 100
                const pat = ex * p / 100
                const edl = ex - ros - pat
                return (
                  <div key={ex} className="grid grid-cols-4 py-2.5">
                    <p className="text-sm font-semibold text-gray-800">{formatarMoeda(ex)}</p>
                    <p className="text-sm text-blue-700 text-right">{formatarMoeda(edl)}</p>
                    <p className="text-sm text-purple-600 text-right">{formatarMoeda(ros)}</p>
                    <p className="text-sm font-semibold text-emerald-600 text-right">{formatarMoeda(pat)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button
          onClick={handleSalvar}
          disabled={r + p > 100 || salvando}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold transition-colors ${
            salvo ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white active:bg-blue-700 disabled:opacity-50'
          }`}
        >
          <Save className="h-4 w-4" />
          {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  )
}