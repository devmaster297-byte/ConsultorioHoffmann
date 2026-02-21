// src/app/(app)/financeiro/inadimplentes/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckSquare,
  Square,
  Check,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  UserX,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useInadimplentes, baixarParcelasEmLote, baixarParcela, Inadimplente, ParcelaComLancamento } from '@/lib/hooks/useFinanceiro'
import { formatarMoeda, formatarData, iniciais } from '@/lib/utils'

export default function InadimplentesPage() {
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const { inadimplentes, carregando, recarregar } = useInadimplentes(clinicaId ?? '')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [modoSelecao, setModoSelecao] = useState(false)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [baixandoLote, setBaixandoLote] = useState(false)

  const totalVencido = inadimplentes.reduce((acc, i) => acc + i.total_vencido, 0)

  function toggleSelecao(parcelaId: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(parcelaId)) next.delete(parcelaId)
      else next.add(parcelaId)
      return next
    })
  }

  function togglePaciente(pacienteId: string, parcelas: ParcelaComLancamento[]) {
    const ids = parcelas.map((p) => p.id)
    const todosSelecionados = ids.every((id) => selecionados.has(id))

    setSelecionados((prev) => {
      const next = new Set(prev)
      if (todosSelecionados) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function toggleExpandido(pacienteId: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(pacienteId)) next.delete(pacienteId)
      else next.add(pacienteId)
      return next
    })
  }

  function toggleModoSelecao() {
    setModoSelecao(!modoSelecao)
    setSelecionados(new Set())
  }

  async function handleBaixarLote() {
    if (selecionados.size === 0) return
    setBaixandoLote(true)
    const ok = await baixarParcelasEmLote([...selecionados])
    setBaixandoLote(false)
    if (ok) {
      setSelecionados(new Set())
      setModoSelecao(false)
      recarregar()
    }
  }

  async function handleBaixarParcela(parcelaId: string) {
    const ok = await baixarParcela(parcelaId)
    if (ok) recarregar()
  }

  if (carregando) {
    return (
      <div className="flex flex-col min-h-full bg-gray-50">
        <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="font-semibold text-gray-900">Inadimplentes</h1>
        </div>
        <div className="px-4 py-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
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
        <h1 className="flex-1 font-semibold text-gray-900">Inadimplentes</h1>
        {inadimplentes.length > 0 && (
          <button
            onClick={toggleModoSelecao}
            className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
              modoSelecao
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {modoSelecao ? 'Cancelar' : 'Selecionar'}
          </button>
        )}
      </div>

      {/* Resumo */}
      {inadimplentes.length > 0 && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-400 font-medium">Total vencido</p>
              <p className="text-xl font-bold text-red-600">{formatarMoeda(totalVencido)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-red-400">{inadimplentes.length} paciente{inadimplentes.length !== 1 ? 's' : ''}</p>
              <p className="text-sm font-semibold text-red-500">
                {inadimplentes.reduce((acc, i) => acc + i.parcelas.length, 0)} parcelas
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 px-4 py-4 pb-32 space-y-2">
        {inadimplentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="font-semibold text-gray-700">Tudo em dia!</p>
            <p className="text-sm text-gray-400 mt-1">Nenhuma parcela vencida</p>
          </div>
        ) : (
          inadimplentes.map((inadimplente) => (
            <InadimplenteCard
              key={inadimplente.paciente_id}
              inadimplente={inadimplente}
              expandido={expandidos.has(inadimplente.paciente_id)}
              modoSelecao={modoSelecao}
              selecionados={selecionados}
              onToggleExpansao={() => toggleExpandido(inadimplente.paciente_id)}
              onTogglePaciente={() => togglePaciente(inadimplente.paciente_id, inadimplente.parcelas)}
              onToggleParcela={toggleSelecao}
              onBaixarParcela={handleBaixarParcela}
            />
          ))
        )}
      </div>

      {/* Barra de ação em lote */}
      {modoSelecao && selecionados.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
          <button
            onClick={handleBaixarLote}
            disabled={baixandoLote}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-semibold text-white shadow-lg disabled:opacity-60 active:bg-emerald-700 transition-colors"
          >
            <Check className="h-5 w-5" />
            {baixandoLote
              ? 'Registrando...'
              : `Baixar ${selecionados.size} parcela${selecionados.size !== 1 ? 's' : ''} · ${formatarMoeda(
                  inadimplentes
                    .flatMap((i) => i.parcelas)
                    .filter((p) => selecionados.has(p.id))
                    .reduce((acc, p) => acc + p.valor - (p.valor_pago ?? 0), 0)
                )}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Card de inadimplente ──────────────────────────────────────────────────────

function InadimplenteCard({
  inadimplente,
  expandido,
  modoSelecao,
  selecionados,
  onToggleExpansao,
  onTogglePaciente,
  onToggleParcela,
  onBaixarParcela,
}: {
  inadimplente: Inadimplente
  expandido: boolean
  modoSelecao: boolean
  selecionados: Set<string>
  onToggleExpansao: () => void
  onTogglePaciente: () => void
  onToggleParcela: (id: string) => void
  onBaixarParcela: (id: string) => Promise<void>
}) {
  const todosSelecionados = inadimplente.parcelas.every((p) => selecionados.has(p.id))
  const [baixandoId, setBaixandoId] = useState<string | null>(null)

  async function handleBaixar(id: string) {
    setBaixandoId(id)
    await onBaixarParcela(id)
    setBaixandoId(null)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Cabeçalho do paciente */}
      <div
        className="flex items-center gap-3 px-4 py-4 active:bg-gray-50 cursor-pointer"
        onClick={modoSelecao ? onTogglePaciente : onToggleExpansao}
      >
        {modoSelecao ? (
          <div
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
              todosSelecionados ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
            }`}
          >
            {todosSelecionados && <Check className="h-3 w-3 text-white" />}
          </div>
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 font-semibold text-sm">
            {iniciais(inadimplente.paciente_nome)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{inadimplente.paciente_nome}</p>
          <p className="text-xs text-red-500 mt-0.5">
            {inadimplente.parcelas.length} parcela{inadimplente.parcelas.length !== 1 ? 's' : ''} vencida{inadimplente.parcelas.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-bold text-red-600">{formatarMoeda(inadimplente.total_vencido)}</p>
          </div>
          {!modoSelecao && (
            <div className={`transition-transform ${expandido ? 'rotate-180' : ''}`}>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Parcelas expandidas */}
      {expandido && !modoSelecao && (
        <div className="border-t border-gray-100">
          {inadimplente.parcelas.map((parcela, i) => {
            const diasVencido = Math.floor(
              (Date.now() - new Date(parcela.data_vencimento).getTime()) / (1000 * 60 * 60 * 24)
            )

            return (
              <div
                key={parcela.id}
                className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {parcela.lancamento?.descricao}
                    {parcela.numero > 1 && ` · ${parcela.numero}ª parcela`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Venceu {formatarData(parcela.data_vencimento)}
                  </p>
                  <p className="text-xs text-red-400 mt-0.5">{diasVencido}d em atraso</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-gray-800">
                    {formatarMoeda(parcela.valor - (parcela.valor_pago ?? 0))}
                  </span>
                  <button
                    onClick={() => handleBaixar(parcela.id)}
                    disabled={baixandoId === parcela.id}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 active:bg-emerald-100 disabled:opacity-50"
                  >
                    {baixandoId === parcela.id ? (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-emerald-600" />
                    )}
                  </button>
                </div>
              </div>
            )
          })}

          {/* Link para ficha do paciente */}
          <Link
            href={`/pacientes/${inadimplente.paciente_id}`}
            className="flex items-center justify-center gap-1 py-3 text-xs text-blue-600 font-medium border-t border-gray-100 active:bg-gray-50"
          >
            Ver ficha do paciente
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Modo seleção: mostrar todas as parcelas diretamente */}
      {modoSelecao && (
        <div className="border-t border-gray-100">
          {inadimplente.parcelas.map((parcela) => (
            <div
              key={parcela.id}
              onClick={() => onToggleParcela(parcela.id)}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer active:bg-gray-50"
            >
              <div
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  selecionados.has(parcela.id) ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                }`}
              >
                {selecionados.has(parcela.id) && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <p className="flex-1 text-sm text-gray-700 truncate">
                {parcela.lancamento?.descricao}
              </p>
              <span className="text-sm font-semibold text-gray-800 flex-shrink-0">
                {formatarMoeda(parcela.valor - (parcela.valor_pago ?? 0))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
