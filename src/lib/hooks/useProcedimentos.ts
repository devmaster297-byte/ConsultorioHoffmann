// src/lib/hooks/useProcedimentos.ts
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Procedimento } from '@/lib/supabase/types'

export function useProcedimentos(clinicaId: string) {
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!clinicaId) return

    async function carregar() {
      const supabase = createClient()
      const { data } = await supabase
        .from('procedimentos')
        .select('*')
        .eq('clinica_id', clinicaId)
        .eq('ativo', true)
        .order('nome')

      setProcedimentos(data ?? [])
      setCarregando(false)
    }

    carregar()
  }, [clinicaId])

  return { procedimentos, carregando }
}
