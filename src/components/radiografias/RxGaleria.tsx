// src/components/radiografias/RxGaleria.tsx
'use client'

import { useState } from 'react'
import { Plus, ScanLine, Filter } from 'lucide-react'
import { RadiografiaComUrl } from '@/lib/hooks/useRadiografias'
import { RxViewer } from './RxViewer'
import { formatarData } from '@/lib/utils'

const TIPO_LABEL = {
  periapical: 'Periapical',
  panoramico: 'Panorâmico',
  outro: 'Outro',
}

type FiltroTipo = 'todos' | 'periapical' | 'panoramico' | 'outro'

interface Props {
  radiografias: RadiografiaComUrl[]
  carregando: boolean
  onAdicionarClick: () => void
  onDeletar: (rx: RadiografiaComUrl) => Promise<boolean>
  onAtualizarAnotacao: (rxId: string, anotacao: string) => Promise<boolean>
}

export function RxGaleria({
  radiografias,
  carregando,
  onAdicionarClick,
  onDeletar,
  onAtualizarAnotacao,
}: Props) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const filtradas =
    filtroTipo === 'todos'
      ? radiografias
      : radiografias.filter((rx) => rx.tipo === filtroTipo)

  if (carregando) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (radiografias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ScanLine className="h-12 w-12 text-gray-300 mb-3" />
        <p className="font-medium text-gray-500">Nenhuma radiografia</p>
        <p className="text-sm text-gray-400 mt-1">Toque em + para adicionar</p>
        <button
          onClick={onAdicionarClick}
          className="mt-4 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Adicionar raio-x
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Filtros */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            filtroTipo !== 'todos'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          {filtroTipo === 'todos' ? 'Todos os tipos' : TIPO_LABEL[filtroTipo]}
        </button>

        <span className="text-xs text-gray-400">
          {filtradas.length} imagem{filtradas.length !== 1 ? 'ns' : ''}
        </span>
      </div>

      {/* Filtros expandidos */}
      {mostrarFiltros && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
          {(['todos', 'periapical', 'panoramico', 'outro'] as FiltroTipo[]).map((tipo) => (
            <button
              key={tipo}
              onClick={() => { setFiltroTipo(tipo); setMostrarFiltros(false) }}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filtroTipo === tipo
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
            >
              {tipo === 'todos' ? 'Todos' : TIPO_LABEL[tipo]}
            </button>
          ))}
        </div>
      )}

      {/* Grid de miniaturas */}
      <div className="grid grid-cols-3 gap-1.5">
        {filtradas.map((rx, i) => (
          <button
            key={rx.id}
            onClick={() => setViewerIndex(radiografias.indexOf(rx))}
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
                <ScanLine className="h-6 w-6 text-gray-600" />
              </div>
            )}

            {/* Overlay com tipo */}
            {rx.tipo && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                <p className="text-[10px] font-medium text-white truncate">
                  {TIPO_LABEL[rx.tipo]}
                </p>
              </div>
            )}

            {/* Indicador de anotação */}
            {rx.anotacao && (
              <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-400" />
            )}
          </button>
        ))}
      </div>

      {/* Viewer fullscreen */}
      {viewerIndex !== null && (
        <RxViewer
          radiografias={radiografias}
          indexInicial={viewerIndex}
          onFechar={() => setViewerIndex(null)}
          onDeletar={onDeletar}
          onAtualizarAnotacao={onAtualizarAnotacao}
        />
      )}
    </>
  )
}
