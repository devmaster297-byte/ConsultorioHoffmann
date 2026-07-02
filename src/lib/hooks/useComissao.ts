// src/lib/hooks/useComissao.ts
// Lê e salva os percentuais de comissão diretamente na tabela `clinicas`.
// Substitui o comissao.store.ts (que usava localStorage e era perdido ao
// trocar de dispositivo).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'

interface Comissao {
  percentualRosieli:  number
  percentualPatricia: number
}

interface UseComissaoReturn extends Comissao {
  carregando: boolean
  salvar: (valores: Comissao) => Promise<{ ok: boolean; erro?: string }>
}

const DEFAULTS: Comissao = { percentualRosieli: 25, percentualPatricia: 5 }

export function useComissao(): UseComissaoReturn {
  const clinicaId = useAuthStore(s => s.clinicaId)
  const [valores, setValores] = useState<Comissao>(DEFAULTS)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)
    const { data } = await supabase
      .from('clinicas')
      .select('percentual_rosieli, percentual_patricia')
      .eq('id', clinicaId)
      .single()

    if (data) {
      setValores({
        percentualRosieli:  Number(data.percentual_rosieli),
        percentualPatricia: Number(data.percentual_patricia),
      })
    }
    setCarregando(false)
  }, [clinicaId])

  useEffect(() => { carregar() }, [carregar])

  const salvar = useCallback(async (novos: Comissao) => {
    if (!clinicaId) return { ok: false, erro: 'Clínica não identificada' }

    const { error } = await supabase
      .from('clinicas')
      .update({
        percentual_rosieli:  novos.percentualRosieli,
        percentual_patricia: novos.percentualPatricia,
      })
      .eq('id', clinicaId)

    if (error) return { ok: false, erro: error.message }

    setValores(novos)
    return { ok: true }
  }, [clinicaId])

  return { ...valores, carregando, salvar }
}