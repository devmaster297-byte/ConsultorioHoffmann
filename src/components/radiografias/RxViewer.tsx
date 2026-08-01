// src/components/radiografias/RxViewer.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react'
import { RadiografiaComUrl } from '@/lib/hooks/useRadiografias'
import { formatarData } from '@/lib/utils'

const TIPO_LABEL: Record<string, string> = {
  periapical: 'Periapical',
  panoramico: 'Panorâmico',
  outro: 'Outro',
}

interface Props {
  radiografias: RadiografiaComUrl[]
  indexInicial: number
  onFechar: () => void
  onDeletar: (rx: RadiografiaComUrl) => Promise<boolean>
  onAtualizarAnotacao: (rxId: string, anotacao: string) => Promise<boolean>
}

export function RxViewer({
  radiografias,
  indexInicial,
  onFechar,
  onDeletar,
  onAtualizarAnotacao,
}: Props) {
  const [index, setIndex] = useState(indexInicial)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [editandoAnotacao, setEditandoAnotacao] = useState(false)
  const [anotacaoEdit, setAnotacaoEdit] = useState('')
  const [confirmandoDelete, setConfirmandoDelete] = useState(false)
  const [deletando, setDeletando] = useState(false)
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false)

  // Touch/pinch state
  const lastTouchDistance = useRef<number | null>(null)
  const isDragging = useRef(false)
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null)
  const imgContainerRef = useRef<HTMLDivElement>(null)

  const rx = radiografias[index]

  useEffect(() => {
    // Reset zoom quando troca de imagem
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setEditandoAnotacao(false)
    setConfirmandoDelete(false)
  }, [index])

  useEffect(() => {
    // Bloquear scroll do body
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  function proximaImagem() {
    if (index < radiografias.length - 1) setIndex(index + 1)
  }

  function imagemAnterior() {
    if (index > 0) setIndex(index - 1)
  }

  function resetZoom() {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  function aumentarZoom() {
    setZoom((z) => Math.min(z + 0.5, 4))
  }

  function diminuirZoom() {
    setZoom((z) => {
      const novoZoom = Math.max(z - 0.5, 1)
      if (novoZoom === 1) setOffset({ x: 0, y: 0 })
      return novoZoom
    })
  }

  // Pinch-to-zoom handlers
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy)
    } else if (e.touches.length === 1 && zoom > 1) {
      isDragging.current = true
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const ratio = dist / lastTouchDistance.current
      setZoom((z) => Math.min(Math.max(z * ratio, 1), 4))
      lastTouchDistance.current = dist
    } else if (e.touches.length === 1 && isDragging.current && lastTouchPos.current) {
      const dx = e.touches[0].clientX - lastTouchPos.current.x
      const dy = e.touches[0].clientY - lastTouchPos.current.y
      setOffset((o) => ({ x: o.x + dx, y: o.y + dy }))
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  function handleTouchEnd() {
    lastTouchDistance.current = null
    isDragging.current = false
    lastTouchPos.current = null
  }

  // Double-tap para zoom
  const lastTapTime = useRef(0)
  function handleTap() {
    const now = Date.now()
    if (now - lastTapTime.current < 300) {
      // Double tap
      if (zoom > 1) {
        resetZoom()
      } else {
        setZoom(2.5)
      }
    }
    lastTapTime.current = now
  }

  // Swipe para navegar (quando não está com zoom)
  const swipeStartX = useRef<number | null>(null)
  function handleSwipeStart(e: React.TouchEvent) {
    if (zoom > 1) return
    swipeStartX.current = e.touches[0].clientX
  }

  function handleSwipeEnd(e: React.TouchEvent) {
    if (zoom > 1 || swipeStartX.current === null) return
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    if (Math.abs(dx) > 60) {
      if (dx < 0) proximaImagem()
      else imagemAnterior()
    }
    swipeStartX.current = null
  }

  async function handleDeletar() {
    setDeletando(true)
    const ok = await onDeletar(rx)
    if (ok) {
      if (radiografias.length <= 1) {
        onFechar()
      } else {
        setIndex(Math.max(0, index - 1))
        setConfirmandoDelete(false)
      }
    }
    setDeletando(false)
  }

  async function handleSalvarAnotacao() {
    setSalvandoAnotacao(true)
    await onAtualizarAnotacao(rx.id, anotacaoEdit)
    setSalvandoAnotacao(false)
    setEditandoAnotacao(false)
  }

  function abrirEdicaoAnotacao() {
    setAnotacaoEdit(rx.anotacao ?? '')
    setEditandoAnotacao(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm">
        <button onClick={onFechar} className="p-2 rounded-full bg-white/10 active:bg-white/20">
          <X className="h-5 w-5 text-white" />
        </button>

        <div className="text-center">
          <p className="text-sm font-medium text-white">
            {rx.tipo ? TIPO_LABEL[rx.tipo] : 'Raio-X'}
          </p>
          <p className="text-xs text-white/60">
            {index + 1} / {radiografias.length}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setConfirmandoDelete(true)}
            className="p-2 rounded-full bg-white/10 active:bg-white/20"
          >
            <Trash2 className="h-4 w-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Área da imagem */}
      <div
        ref={imgContainerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onTouchStart={(e) => { handleTouchStart(e); handleSwipeStart(e) }}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => { handleTouchEnd(); handleSwipeEnd(e) }}
        onClick={handleTap}
      >
        {rx.signed_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={rx.signed_url}
            alt={rx.anotacao ?? 'Radiografia'}
            className="max-h-full max-w-full object-contain select-none"
            style={{
              transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
              transition: lastTouchDistance.current ? 'none' : 'transform 0.1s ease',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
            draggable={false}
          />
        ) : (
          <div className="text-white/40 text-sm">Imagem indisponível</div>
        )}

        {/* Navegação lateral */}
        {index > 0 && zoom === 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); imagemAnterior() }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 active:bg-black/60"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
        )}
        {index < radiografias.length - 1 && zoom === 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); proximaImagem() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 active:bg-black/60"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        )}
      </div>

      {/* Controles de zoom */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); aumentarZoom() }}
          className="p-2 rounded-full bg-black/40 active:bg-black/60 disabled:opacity-30"
          disabled={zoom >= 4}
        >
          <ZoomIn className="h-5 w-5 text-white" />
        </button>
        {zoom > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); resetZoom() }}
            className="p-2 rounded-full bg-black/40 active:bg-black/60"
          >
            <RotateCcw className="h-5 w-5 text-white" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); diminuirZoom() }}
          className="p-2 rounded-full bg-black/40 active:bg-black/60 disabled:opacity-30"
          disabled={zoom <= 1}
        >
          <ZoomOut className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Barra inferior — metadados e anotação */}
      <div className="bg-black/80 backdrop-blur-sm px-4 py-4">
        {rx.data_exame && (
          <p className="text-xs text-white/50 mb-2">{formatarData(rx.data_exame)}</p>
        )}

        {editandoAnotacao ? (
          <div className="flex items-start gap-2">
            <textarea
              value={anotacaoEdit}
              onChange={(e) => setAnotacaoEdit(e.target.value)}
              autoFocus
              rows={2}
              placeholder="Anotação..."
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSalvarAnotacao}
                disabled={salvandoAnotacao}
                className="p-2.5 rounded-xl bg-blue-600 active:bg-blue-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4 text-white" />
              </button>
              <button
                onClick={() => setEditandoAnotacao(false)}
                className="p-2.5 rounded-xl bg-white/10 active:bg-white/20"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={abrirEdicaoAnotacao}
            className="flex w-full items-start gap-2 text-left"
          >
            <Edit2 className="h-3.5 w-3.5 text-white/40 mt-0.5 flex-shrink-0" />
            <p className={`text-sm flex-1 ${rx.anotacao ? 'text-white/80' : 'text-white/30 italic'}`}>
              {rx.anotacao || 'Toque para adicionar anotação...'}
            </p>
          </button>
        )}

        {/* Indicadores de página */}
        {radiografias.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {radiografias.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'bg-white w-4' : 'bg-white/30 w-1.5'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de confirmação de exclusão */}
      {confirmandoDelete && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/60">
          <div className="w-full bg-white rounded-t-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-center">Excluir raio-x?</h3>
            <p className="text-sm text-gray-500 text-center">
              Esta imagem será removida permanentemente.
            </p>
            <button
              onClick={handleDeletar}
              disabled={deletando}
              className="w-full rounded-xl bg-red-600 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {deletando ? 'Excluindo...' : 'Sim, excluir'}
            </button>
            <button
              onClick={() => setConfirmandoDelete(false)}
              className="w-full rounded-xl bg-gray-100 py-3.5 text-sm font-medium text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
