// src/app/(app)/radiografias/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, ScanLine, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { RxViewer } from '@/components/radiografias/RxViewer'
import { RadiografiaComUrl } from '@/lib/hooks/useRadiografias'
import { formatarData, debounce } from '@/lib/utils'

const TIPO_LABEL: Record<string, string> = {
  periapical: 'Periapical',
  panoramico: 'Panorâmico',
  outro: 'Outro',
}

interface RxComPaciente extends RadiografiaComUrl {
  paciente_nome: string
}

// Interface ajustada para incluir os campos que o TS reclamou
interface RadiografiaRaw {
  id: string
  clinica_id: string
  paciente_id: string
  atendimento_id: string | null // Adicionado
  storage_path: string
  thumbnail_path: string | null // Adicionado
  anotacao: string | null
  tipo: string | null
  data_exame: string | null // Adicionado
  created_at: string
  paciente: { nome: string } | { nome: string }[] | null
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

      const rawData = (data as unknown as RadiografiaRaw[] || [])

      let lista = await Promise.all(
        rawData.map(async (rx) => {
          const { data: urlData } = await supabase.storage
            .from('radiografias')
            .createSignedUrl(rx.storage_path, 3600)

          const pNome = Array.isArray(rx.paciente) 
            ? rx.paciente[0]?.nome 
            : rx.paciente?.nome

          // Criamos o objeto garantindo todas as propriedades da interface
          const rxFormatado: RxComPaciente = {
            id: rx.id,
            clinica_id: rx.clinica_id,
            paciente_id: rx.paciente_id,
            atendimento_id: rx.atendimento_id,
            storage_path: rx.storage_path,
            thumbnail_path: rx.thumbnail_path,
            anotacao: rx.anotacao,
            tipo: rx.tipo as any,
            data_exame: rx.data_exame,
            created_at: rx.created_at,
            signed_url: urlData?.signedUrl ?? null,
            paciente_nome: pNome ?? 'Paciente não identificado',
          }

          return rxFormatado
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

  const carregarDebounced = useCallback(debounce((q: string) => carregar(q), 300), [carregar])

  useEffect(() => { carregar('') }, [carregar])
  useEffect(() => { 
    if (busca.trim() !== '') {
      carregarDebounced(busca) 
    } else {
      carregar('')
    }
  }, [busca, carregarDebounced, carregar])

  async function handleDeletar(rx: RadiografiaComUrl) {
    const supabase = createClient()
    const { error } = await supabase.from('radiografias').delete().eq('id', rx.id)
    if (error) return false

    await supabase.storage.from('radiografias').remove([rx.storage_path])
    setRxs((prev) => prev.filter((r) => r.id !== rx.id))
    if (rxs.length <= 1) setViewerIndex(null)
    return true
  }

  async function handleAtualizarAnotacao(rxId: string, anotacao: string) {
    const supabase = createClient()
    const { error } = await supabase.from('radiografias').update({ anotacao }).eq('id', rxId)
    if (error) return false

    setRxs((prev) => prev.map((r) => (r.id === rxId ? { ...r, anotacao } : r)))
    return true
  }

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
    <div className="flex flex-col h-full bg-gray-50">
      <div className="sticky top-0 z-10 bg-gray-50 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Raio-X</h1>
          <button
            onClick={() => setMostrarUploader(true)}
            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md active:scale-95 transition-transform"
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

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {carregando ? (
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : rxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ScanLine className="h-12 w-12 text-gray-300 mb-3" />
            <p className="font-medium text-gray-500">Nenhuma radiografia encontrada</p>
          </div>
        ) : (
          <div className="space-y-6 mt-2">
            {Object.entries(grupos).map(([chave, lista]) => (
              <div key={chave}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  {labelMes(chave)}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {lista.map((rx) => (
                    <button
                      key={rx.id}
                      onClick={() => setViewerIndex(rxs.indexOf(rx))}
                      className="relative aspect-square rounded-xl overflow-hidden bg-gray-900 active:scale-95 transition-transform"
                    >
                      {rx.signed_url ? (
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
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 text-left">
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

      {viewerIndex !== null && (
        <RxViewer
          radiografias={rxs}
          indexInicial={viewerIndex}
          onFechar={() => setViewerIndex(null)}
          onDeletar={handleDeletar}
          onAtualizarAnotacao={handleAtualizarAnotacao}
        />
      )}

      {mostrarUploader && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50 p-4">
          <div className="w-full bg-white rounded-2xl p-6 shadow-2xl max-w-sm mx-auto mb-4">
            <p className="text-center text-sm font-medium text-gray-900 mb-1">Dica</p>
            <p className="text-center text-xs text-gray-500 mb-6">
              Para adicionar um novo raio-X, acesse a ficha do paciente específico e clique em "Adicionar".
            </p>
            <button
              onClick={() => setMostrarUploader(false)}
              className="w-full rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}