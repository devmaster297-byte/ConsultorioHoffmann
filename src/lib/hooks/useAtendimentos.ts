// src/lib/hooks/useAtendimentos.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-browser'

export interface AtendimentoDetalhado {
  id: string
  paciente_id: string
  data_atendimento: string
  procedimento_id: string | null
  procedimento_nome: string | null
  descricao: string | null
  dentista_nome: string | null
  total_radiografias: number
}

export function useAtendimentos(pacienteId: string, clinicaId: string) {
  const [atendimentos, setAtendimentos] = useState<AtendimentoDetalhado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!pacienteId || !clinicaId) return
    setCarregando(true)
    setErro(null)

    const { data: atend, error } = await supabase
      .from('atendimentos')
      .select(`
        id,
        paciente_id,
        dentista_id,
        data_atendimento,
        procedimento_id,
        descricao,
        procedimento:procedimentos(nome)
      `)
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicaId)
      .order('data_atendimento', { ascending: false })

    if (error) {
      setErro('Erro ao carregar histórico')
      setCarregando(false)
      return
    }

    if (!atend || atend.length === 0) {
      setAtendimentos([])
      setCarregando(false)
      return
    }

    // Buscar nomes dos dentistas
    const dentistaIds = [...new Set(
      atend.map((a: typeof atend[number]) => a.dentista_id).filter(Boolean)
    )] as string[]

    const dentistaMap: Record<string, string> = {}
    if (dentistaIds.length > 0) {
      const { data: dentistas } = await supabase
        .from('usuarios')
        .select('id, nome')
        .in('id', dentistaIds)
      dentistas?.forEach((d: { id: string; nome: string }) => {
        dentistaMap[d.id] = d.nome
      })
    }

    // Buscar contagem de radiografias por atendimento
    const atendIds = atend.map((a: typeof atend[number]) => a.id)
    const { data: rxCounts } = await supabase
      .from('radiografias')
      .select('atendimento_id')
      .in('atendimento_id', atendIds)

    const rxPorAtend: Record<string, number> = {}
    rxCounts?.forEach((rx: { atendimento_id: string }) => {
      if (rx.atendimento_id) {
        rxPorAtend[rx.atendimento_id] = (rxPorAtend[rx.atendimento_id] ?? 0) + 1
      }
    })

    const resultado: AtendimentoDetalhado[] = atend.map((a: typeof atend[number]) => ({
      id: a.id,
      paciente_id: a.paciente_id,
      data_atendimento: a.data_atendimento,
      procedimento_id: a.procedimento_id,
      procedimento_nome: (a.procedimento as unknown as { nome: string } | null)?.nome ?? null,
      descricao: a.descricao,
      dentista_nome: a.dentista_id ? (dentistaMap[a.dentista_id] ?? null) : null,
      total_radiografias: rxPorAtend[a.id] ?? 0,
    }))

    setAtendimentos(resultado)
    setCarregando(false)
  }, [pacienteId, clinicaId])

  useEffect(() => { carregar() }, [carregar])

  return { atendimentos, carregando, erro, recarregar: carregar }
}
