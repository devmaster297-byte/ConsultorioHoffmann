// src/app/(app)/historico/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Search, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { formatarData, formatarMoeda, debounce } from '@/lib/utils'

interface AtendimentoGlobal {
  id: string
  paciente_id: string
  paciente_nome: string
  data_atendimento: string
  procedimento_nome: string | null
  descricao: string | null
  valor_total: number | null
}

export default function HistoricoPage() {
  const { clinicaId } = useAuthStore()
  const [atendimentos, setAtendimentos] = useState<AtendimentoGlobal[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [buscando, setBuscando] = useState(false)

  const carregar = useCallback(
    async (query = '') => {
      if (!clinicaId) return
      setBuscando(true)

      const supabase = createClient()
      let req = supabase
        .from('atendimentos')
        .select(`
          id,
          paciente_id,
          data_atendimento,
          descricao,
          valor_total,
          procedimento:procedimentos(nome),
          paciente:pacientes(nome)
        `)
        .eq('clinica_id', clinicaId)
        .order('data_atendimento', { ascending: false })
        .limit(100)

      const { data } = await req

      let resultado = (data ?? []).map((a) => ({
        id: a.id,
        paciente_id: a.paciente_id,
        paciente_nome: (a.paciente as { nome: string } | null)?.nome ?? '',
        data_atendimento: a.data_atendimento,
        procedimento_nome: (a.procedimento as { nome: string } | null)?.nome ?? null,
        descricao: a.descricao,
        valor_total: a.valor_total,
      }))

      if (query.trim()) {
        const q = query.toLowerCase()
        resultado = resultado.filter(
          (a) =>
            a.paciente_nome.toLowerCase().includes(q) ||
            (a.procedimento_nome?.toLowerCase().includes(q) ?? false) ||
            (a.descricao?.toLowerCase().includes(q) ?? false)
        )
      }

      setAtendimentos(resultado)
      setBuscando(false)
      setCarregando(false)
    },
    [clinicaId]
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const carregarDebounced = useCallback(debounce(carregar, 300), [carregar])

  useEffect(() => { carregar('') }, [carregar])
  useEffect(() => { carregarDebounced(busca) }, [busca, carregarDebounced])

  // Agrupar por data
  const grupos = atendimentos.reduce<Record<string, AtendimentoGlobal[]>>((acc, a) => {
    const data = a.data_atendimento
    if (!acc[data]) acc[data] = []
    acc[data].push(a)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-gray-900 mb-3">Histórico</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar por paciente ou procedimento..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-xl border-0 bg-white py-3 pl-9 pr-4 text-sm shadow-sm ring-1 ring-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {buscando && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          )}
        </div>
      </div>

      {/* Lista agrupada por data */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {carregando ? (
          <div className="space-y-3 mt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : atendimentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-gray-300 mb-3" />
            <p className="font-medium text-gray-500">
              {busca ? 'Nenhum resultado encontrado' : 'Nenhum atendimento registrado'}
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-5">
            {Object.entries(grupos).map(([data, items]) => (
              <div key={data}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  {formatarData(data)}
                </p>
                <div className="space-y-2">
                  {items.map((a) => (
                    <Link
                      key={a.id}
                      href={`/pacientes/${a.paciente_id}/atendimento/${a.id}`}
                      className="flex items-center justify-between bg-white rounded-xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{a.paciente_nome}</p>
                        <p className="text-sm text-gray-500 truncate mt-0.5">
                          {a.procedimento_nome ?? a.descricao ?? 'Atendimento'}
                        </p>
                      </div>
                      {a.valor_total != null && (
                        <span className="ml-3 text-sm font-semibold text-gray-700 flex-shrink-0">
                          {formatarMoeda(a.valor_total)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
