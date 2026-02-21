// src/components/radiografias/RxUploader.tsx
'use client'

import { useRef, useState } from 'react'
import { Camera, ImagePlus, X, Upload, ChevronDown } from 'lucide-react'

interface Props {
  onFechar: () => void
  onUpload: (
    file: File,
    meta: {
      anotacao?: string
      data_exame?: string
      tipo?: 'periapical' | 'panoramico' | 'outro'
      atendimento_id?: string
    }
  ) => Promise<{ sucesso: boolean; erro?: string }>
  atendimentoId?: string
}

type Etapa = 'escolha' | 'preview'

export function RxUploader({ onFechar, onUpload, atendimentoId }: Props) {
  const inputCameraRef = useRef<HTMLInputElement>(null)
  const inputGaleriaRef = useRef<HTMLInputElement>(null)
  const [etapa, setEtapa] = useState<Etapa>('escolha')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [anotacao, setAnotacao] = useState('')
  const [dataExame, setDataExame] = useState(new Date().toISOString().split('T')[0])
  const [tipo, setTipo] = useState<'periapical' | 'panoramico' | 'outro'>('periapical')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function handleArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setErro('Apenas imagens são aceitas (JPG, PNG)')
      return
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErro('Imagem muito grande. Máximo 10MB.')
      return
    }

    setArquivo(file)
    setPreviewUrl(URL.createObjectURL(file))
    setEtapa('preview')
    setErro(null)
  }

  async function handleEnviar() {
    if (!arquivo) return
    setEnviando(true)
    setErro(null)

    const resultado = await onUpload(arquivo, {
      anotacao: anotacao.trim() || undefined,
      data_exame: dataExame || undefined,
      tipo,
      atendimento_id: atendimentoId,
    })

    if (!resultado.sucesso) {
      setErro(resultado.erro ?? 'Erro ao enviar')
      setEnviando(false)
      return
    }

    // Limpar URL de preview
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    onFechar()
  }

  function voltarParaEscolha() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setArquivo(null)
    setPreviewUrl(null)
    setEtapa('escolha')
    setErro(null)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={etapa === 'escolha' ? onFechar : undefined}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          {etapa === 'preview' ? (
            <button onClick={voltarParaEscolha} className="text-sm text-blue-600 font-medium">
              ← Trocar imagem
            </button>
          ) : (
            <h2 className="font-semibold text-gray-900">Adicionar Raio-X</h2>
          )}
          <button onClick={onFechar} className="p-1 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Inputs de arquivo ocultos */}
        <input
          ref={inputCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleArquivoSelecionado}
        />
        <input
          ref={inputGaleriaRef}
          type="file"
          accept="image/*"
          multiple={false}
          className="hidden"
          onChange={handleArquivoSelecionado}
        />

        {etapa === 'escolha' ? (
          <div className="px-4 pb-6 space-y-3">
            <button
              onClick={() => inputCameraRef.current?.click()}
              className="flex w-full items-center gap-4 rounded-2xl bg-blue-600 px-5 py-4 text-white active:bg-blue-700 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Camera className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Usar câmera</p>
                <p className="text-xs text-blue-100">Fotografar agora</p>
              </div>
            </button>

            <button
              onClick={() => inputGaleriaRef.current?.click()}
              className="flex w-full items-center gap-4 rounded-2xl bg-gray-100 px-5 py-4 text-gray-800 active:bg-gray-200 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                <ImagePlus className="h-5 w-5 text-gray-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Escolher da galeria</p>
                <p className="text-xs text-gray-500">JPG, PNG — máx 10MB</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="px-4 pb-6 space-y-4">
            {/* Preview da imagem */}
            {previewUrl && (
              <div className="relative overflow-hidden rounded-2xl bg-gray-900 h-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-full w-full object-contain"
                />
              </div>
            )}

            {/* Metadados */}
            <div className="space-y-3">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <div className="relative">
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as typeof tipo)}
                    className="w-full appearance-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="periapical">Periapical</option>
                    <option value="panoramico">Panorâmico</option>
                    <option value="outro">Outro</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Data do exame */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Data do exame
                </label>
                <input
                  type="date"
                  value={dataExame}
                  onChange={(e) => setDataExame(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Anotação */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Anotação (dente, laudo...)
                </label>
                <textarea
                  value={anotacao}
                  onChange={(e) => setAnotacao(e.target.value)}
                  placeholder="Ex: Dente 16, periapical c/ lesão..."
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            {erro && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
            )}

            <button
              onClick={handleEnviar}
              disabled={enviando}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white disabled:opacity-60 active:bg-blue-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {enviando ? 'Enviando...' : 'Salvar Raio-X'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
