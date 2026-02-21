// src/app/(app)/radiografias/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Search, ScanLine, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { RxViewer } from '@/components/radiografias/RxViewer'
import { RxUploader } from '@/components/radiografias/RxUploader'
import { RadiografiaComUrl, useRadiografias } from '@/lib/hooks/useRadiografias'
import { formatarData, debounce, iniciais } from '@/lib/utils'

const TIPO_LABEL: Record<string, string> = {
  periapical: 'Periapical',
  panoramico: 'Panorâmico',
  outro: 'Outro',
}

interface RxComPaciente extends RadiografiaComUrl {
  paciente_nome: string
}

export default function RadiografiasGlobalPage() {
  const { clinicaId } = useAuthStore()
  const [rxs, setRxs] = useState<RxComPaciente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [mostrarUploader, setMostrarUploader] = useState(false)

  const carregar = useCallback(
    async (query = '') => {
      if (!clinicaId) return
      setCarregando(true)

      const supabase = createClient()
      const { data } = await supabase
        .from('radiografias')
        .select(`*, paciente:pacientes(nome)`)
        .eq('clinica_id', clinicaId)
        .order('created_at', { ascending: false })
        .limit(100)

      let lista = await Promise.all(
        (data ?? []).map(async (rx) => {
          const { data: urlData } = await supabase.storage
            .from('radiografias')
            .createSignedUrl(rx.storage_path, 3600)

          return {
            ...rx,
            signed_url: urlData?.signedUrl ?? null,
            paciente_nome: (rx.paciente as unknown as { nome: string } | null)?.nome ?? '',
          } as RxComPaciente
        })
      )

      if (query.trim()) {
        const q = query.toLowerCase()
        lista = lista.filter(
          (rx) =>
            rx.paciente_nome.toLowerCase().includes(q) ||
            (rx.anotacao?.toLowerCase().includes(q) ?? false)
        )
      }

      setRxs(lista)
      setCarregando(false)
    },
    [clinicaId]
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const carregarDebounced = useCallback(debounce(carregar, 300), [carregar])

  useEffect(() => { carregar('') }, [carregar])
  useEffect(() => { carregarDebounced(busca) }, [busca, carregarDebounced])

  async function handleDeletar(rx: RadiografiaComUrl) {
    const supabase = createClient()
    await supabase.from('radiografias').delete().eq('id', rx.id)
    await supabase.storage.from('radiografias').remove([rx.storage_path])
    setRxs((prev) => prev.filter((r) => r.id !== rx.id))
    if (rxs.length <= 1) setViewerIndex(null)
    return true
  }

  async function handleAtualizarAnotacao(rxId: string, anotacao: string) {
    const supabase = createClient()
    await supabase.from('radiografias').update({ anotacao }).eq('id', rxId)
    setRxs((prev) => prev.map((r) => (r.id === rxId ? { ...r, anotacao } : r)))
    return true
  }

  // Agrupar por mês
  const grupos = rxs.reduce<Record<string, RxComPaciente[]>>((acc, rx) => {
    const chave = rx.created_at.slice(0, 7)
    if (!acc[chave]) acc[chave] = []
    acc[chave].push(rx)
    return acc
  }, {})

  function labelMes(chave: string) {
    const [ano, mes] = chave.split('-')
    return new Date(Number(ano), Number(mes) - 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Raio-X</h1>
          <button
            onClick={() => setMostrarUploader(true)}
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Novo
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar por paciente ou anotação..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-xl border-0 bg-white py-3 pl-9 pr-4 text-sm shadow-sm ring-1 ring-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {carregando ? (
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : rxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ScanLine className="h-12 w-12 text-gray-300 mb-3" />
            <p className="font-medium text-gray-500">Nenhuma radiografia</p>
          </div>
        ) : (
          <div className="space-y-6 mt-2">
            {Object.entries(grupos).map(([chave, lista]) => (
              <div key={chave}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1 capitalize">
                  {labelMes(chave)}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {lista.map((rx, i) => (
                    <button
                      key={rx.id}
                      onClick={() => setViewerIndex(rxs.indexOf(rx))}
                      className="relative aspect-square rounded-xl overflow-hidden bg-gray-900 active:scale-95 transition-transform"
                    >
                      {rx.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rx.signed_url}
                          alt={rx.anotacao ?? 'Raio-X'}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ScanLine className="h-5 w-5 text-gray-600" />
                        </div>
                      )}

                      {/* Overlay com nome do paciente */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                        <p className="text-[10px] font-semibold text-white truncate leading-tight">
                          {rx.paciente_nome.split(' ')[0]}
                        </p>
                        {rx.tipo && (
                          <p className="text-[9px] text-white/60 truncate">
                            {TIPO_LABEL[rx.tipo]}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Viewer */}
      {viewerIndex !== null && (
        <RxViewer
          radiografias={rxs}
          indexInicial={viewerIndex}
          onFechar={() => setViewerIndex(null)}
          onDeletar={handleDeletar}
          onAtualizarAnotacao={handleAtualizarAnotacao}
        />
      )}

      {/* Uploader sem paciente específico — nota: o upload global precisaria de um seletor de paciente */}
      {mostrarUploader && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50">
          <div className="w-full bg-white rounded-t-2xl p-6">
            <p className="text-center text-sm text-gray-600 mb-4">
              Para adicionar raio-x, acesse a ficha do paciente.
            </p>
            <button
              onClick={() => setMostrarUploader(false)}
              className="w-full rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}