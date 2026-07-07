// src/app/(app)/pacientes/page.tsx
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Search, Plus, UserX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Paciente } from '@/lib/supabase/types'
import { StatusFinanceiro, calcularStatusEmBatch } from '@/lib/hooks/usePacienteStatus'
import { PacienteCard } from '@/components/pacientes/PacienteCard'
import { useAuthStore } from '@/store/auth.store'
import { debounce } from '@/lib/utils'

const PAGE_SIZE = 50

export default function PacientesPage() {
  const { clinicaId } = useAuthStore()
  const [busca, setBusca] = useState('')
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, StatusFinanceiro>>({})
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [temMais, setTemMais] = useState(false)

  // Refs para evitar closure desatualizado no IntersectionObserver
  const buscaRef = useRef('')
  const offsetRef = useRef(0)
  const carregandoMaisRef = useRef(false)
  const temMaisRef = useRef(false)
  // Ref do container rolável — necessário para o IntersectionObserver funcionar
  // dentro de um div com overflow-y-auto (não rola no window, rola no container)
  const containerRef = useRef<HTMLDivElement>(null)

  const carregar = useCallback(
    async (query: string, offsetAtual: number, append: boolean) => {
      if (!clinicaId) return

      if (append) {
        carregandoMaisRef.current = true
        setCarregandoMais(true)
      } else {
        setCarregando(true)
      }

      const supabase = createClient()
      let req = supabase
        .from('pacientes')
        .select('*')
        .eq('clinica_id', clinicaId)
        .order('nome')
        .range(offsetAtual, offsetAtual + PAGE_SIZE - 1)

      if (query.trim()) {
        req = req.or(
          `nome.ilike.%${query}%,cpf.ilike.%${query}%,telefone.ilike.%${query}%`
        )
      }

      const { data } = await req
      const lista = (data ?? []) as Paciente[]

      if (append) {
        setPacientes((prev) => [...prev, ...lista])
      } else {
        setPacientes(lista)
      }

      const novoOffset = offsetAtual + lista.length
      offsetRef.current = novoOffset

      const ainda_tem_mais = lista.length === PAGE_SIZE
      temMaisRef.current = ainda_tem_mais
      setTemMais(ainda_tem_mais)

      if (lista.length > 0) {
        const ids = lista.map((p) => p.id)
        const status = await calcularStatusEmBatch(ids, clinicaId)
        setStatusMap((prev) => (append ? { ...prev, ...status } : status))
      }

      if (append) {
        carregandoMaisRef.current = false
        setCarregandoMais(false)
      } else {
        setCarregando(false)
      }
    },
    [clinicaId]
  )

  // Sentinel para scroll infinito
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = containerRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          temMaisRef.current &&
          !carregandoMaisRef.current
        ) {
          carregar(buscaRef.current, offsetRef.current, true)
        }
      },
      {
        root: container,       // ← observar dentro do div rolável, não no window
        rootMargin: '300px',
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [carregar])

  // Busca com debounce
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const buscarDebounced = useCallback(
    debounce((query: string) => {
      buscaRef.current = query
      offsetRef.current = 0
      carregar(query, 0, false)
    }, 300),
    [carregar]
  )

  // Carga inicial
  useEffect(() => {
    carregar('', 0, false)
  }, [carregar])

  // Ao digitar na busca
  useEffect(() => {
    buscaRef.current = busca
    offsetRef.current = 0
    buscarDebounced(busca)
  }, [busca, buscarDebounced])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Pacientes</h1>
          <Link
            href="/pacientes/novo"
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm active:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo
          </Link>
        </div>

        {/* Campo de busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar por nome, CPF ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-xl border-0 bg-white py-3 pl-9 pr-4 text-sm shadow-sm ring-1 ring-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Lista */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 pb-4">
        {carregando ? (
          <div className="space-y-3 mt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[76px] rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : pacientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserX className="h-12 w-12 text-gray-300 mb-3" />
            <p className="font-medium text-gray-500">
              {busca ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
            </p>
            {!busca && (
              <Link
                href="/pacientes/novo"
                className="mt-4 text-sm text-blue-600 font-medium"
              >
                Cadastrar primeiro paciente →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {pacientes.map((paciente) => (
              <PacienteCard
                key={paciente.id}
                paciente={paciente}
                status={statusMap[paciente.id] ?? 'em_dia'}
              />
            ))}

            {/* Sentinel — dispara o carregamento da próxima página */}
            <div ref={sentinelRef} />

            {/* Feedback de carregamento / fim da lista */}
            {carregandoMais && (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              </div>
            )}

            {!temMais && (
              <p className="text-center text-xs text-gray-400 pt-2">
                {pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''} cadastrado{pacientes.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}