// src/lib/hooks/useRadiografias.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { Radiografia } from '@/lib/supabase/types'

export interface RadiografiaComUrl extends Radiografia {
  signed_url: string | null
}

// Interface para tipar explicitamente o retorno do banco de dados
interface RadiografiaRaw extends Radiografia {
  storage_path: string
  thumbnail_path: string | null
}

export function useRadiografias(pacienteId: string, clinicaId: string, atendimentoId?: string) {
  const [radiografias, setRadiografias] = useState<RadiografiaComUrl[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!pacienteId || !clinicaId) return
    setCarregando(true)
    setErro(null)


    let req = supabase
      .from('radiografias')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false })

    if (atendimentoId) {
      req = req.eq('atendimento_id', atendimentoId)
    }

    const { data, error } = await req

    if (error) {
      setErro('Erro ao carregar radiografias')
      setCarregando(false)
      return
    }

    if (!data || data.length === 0) {
      setRadiografias([])
      setCarregando(false)
      return
    }

    // Casting explícito para RadiografiaRaw[] resolve o erro de 'any' implícito
    const rawData = data as unknown as RadiografiaRaw[]

    // Gerar signed URLs para todas as imagens (1 hora de validade)
    const comUrls = await Promise.all(
      rawData.map(async (rx) => {
        const { data: urlData } = await supabase.storage
          .from('radiografias')
          .createSignedUrl(rx.storage_path, 3600)

        return {
          ...rx,
          signed_url: urlData?.signedUrl ?? null,
        }
      })
    )

    setRadiografias(comUrls)
    setCarregando(false)
  }, [pacienteId, clinicaId, atendimentoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function uploadRadiografia(
    file: File,
    meta: {
      anotacao?: string
      data_exame?: string
      tipo?: 'periapical' | 'panoramico' | 'outro'
      atendimento_id?: string
    }
  ): Promise<{ sucesso: boolean; erro?: string }> {

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${clinicaId}/${pacienteId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('radiografias')
      .upload(path, file, { contentType: file.type })

    if (uploadError) {
      return { sucesso: false, erro: 'Erro ao enviar imagem. Tente novamente.' }
    }

    const { error: dbError } = await supabase.from('radiografias').insert({
      clinica_id: clinicaId,
      paciente_id: pacienteId,
      atendimento_id: meta.atendimento_id ?? null,
      storage_path: path,
      anotacao: meta.anotacao ?? null,
      data_exame: meta.data_exame ?? null,
      tipo: meta.tipo ?? null,
    })

    if (dbError) {
      await supabase.storage.from('radiografias').remove([path])
      return { sucesso: false, erro: 'Erro ao salvar registro. Tente novamente.' }
    }

    await carregar()
    return { sucesso: true }
  }

  async function deletarRadiografia(rx: RadiografiaComUrl): Promise<boolean> {

    const { error: dbError } = await supabase
      .from('radiografias')
      .delete()
      .eq('id', rx.id)

    if (dbError) return false

    await supabase.storage.from('radiografias').remove([rx.storage_path])
    if (rx.thumbnail_path) {
      await supabase.storage.from('radiografias').remove([rx.thumbnail_path])
    }

    setRadiografias((prev) => prev.filter((r) => r.id !== rx.id))
    return true
  }

  async function atualizarAnotacao(
    rxId: string,
    anotacao: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('radiografias')
      .update({ anotacao })
      .eq('id', rxId)

    if (error) return false

    setRadiografias((prev) =>
      prev.map((r) => (r.id === rxId ? { ...r, anotacao } : r))
    )
    return true
  }

  return {
    radiografias,
    carregando,
    erro,
    recarregar: carregar,
    uploadRadiografia,
    deletarRadiografia,
    atualizarAnotacao,
  }
}