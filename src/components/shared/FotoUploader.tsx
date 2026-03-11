// src/components/shared/FotoUploader.tsx
'use client'

import { useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, User } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

interface Props {
  clinicaId: string
  pacienteId: string
  fotoAtual: string | null
  onAtualizar: (novaUrl: string) => void
}

export function FotoUploader({ clinicaId, pacienteId, fotoAtual, onAtualizar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(fotoAtual)

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErro('Apenas imagens são aceitas')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErro('Imagem muito grande — máx 5MB')
      return
    }

    setEnviando(true)
    setErro(null)

    // Preview imediato (optimistic UI)
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${clinicaId}/fotos/${pacienteId}.${ext}`

    // Upload (upsert — sobrescreve se já existir)
    const { error: uploadErr } = await supabase.storage
      .from('fotos-pacientes')
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadErr) {
      setErro('Erro ao enviar foto')
      setPreviewUrl(fotoAtual)
      setEnviando(false)
      return
    }

    // Gerar signed URL (1 semana) para armazenar no banco
    const { data: urlData } = await supabase.storage
      .from('fotos-pacientes')
      .createSignedUrl(path, 7 * 24 * 3600)

    if (!urlData?.signedUrl) {
      setErro('Erro ao gerar URL da foto')
      setEnviando(false)
      return
    }

    // Atualizar paciente no banco
    await supabase
      .from('pacientes')
      .update({ foto_url: urlData.signedUrl })
      .eq('id', pacienteId)

    onAtualizar(urlData.signedUrl)
    URL.revokeObjectURL(objectUrl)
    setEnviando(false)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        className="relative group"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Foto do paciente"
            className="h-20 w-20 rounded-full object-cover ring-2 ring-offset-2 ring-blue-200 group-active:ring-blue-400 transition-all"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 ring-2 ring-offset-2 ring-blue-200 group-active:ring-blue-400 transition-all">
            <User className="h-8 w-8 text-blue-400" />
          </div>
        )}

        {/* Overlay de loading */}
        {enviando && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}

        {/* Badge de câmera */}
        <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 border-2 border-white shadow-sm">
          <Camera className="h-3.5 w-3.5 text-white" />
        </div>
      </button>

      <span className="text-xs text-blue-600 font-medium">
        {previewUrl ? 'Trocar foto' : 'Adicionar foto'}
      </span>

      {erro && <p className="text-xs text-red-500">{erro}</p>}

      {/* Input oculto — aceita câmera e galeria */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleArquivo}
      />
    </div>
  )
}
