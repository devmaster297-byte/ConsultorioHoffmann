// src/app/(app)/financeiro/parcelas/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { ParcelaComLancamento, baixarParcela } from '@/lib/hooks/useFinanceiro'
import { ParcelaItem } from '@/components/financeiro/ParcelaItem'
import { ModalPagamentoParcial } from '@/components/financeiro/ModalPagamentoParcial'
import { formatarMoeda } from '@/lib/utils'

// Tipos auxiliares para evitar o erro de 'any' implícito no map
interface LancamentoBasico {
  id: string
  descricao: string
  tipo: 'receita' | 'despesa'
  paciente_id: string | null
  atendimento_id: string | null
}

interface PacienteBasico {
  id: string
  nome: string
}

type FiltroStatus = 'pendente' | 'vencido' | 'pago' | 'pago_parcial' | 'todos'

export default function ParcelasPage() {
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const [parcelas, setParcelas] = useState<ParcelaComLancamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<FiltroStatus>('pendente')
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaComLancamento | null>(null)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)


    // Buscar parcelas direto por clinica_id (sem passar por .in() de lançamentos —
    // com centenas de lançamentos isso gera uma URL enorme e o PostgREST retorna 400).
    let req = supabase
      .from('financeiro_parcelas')
      .select('*')
      .eq('clinica_id', clinicaId)
      .order('data_vencimento', { ascending: false })
      .limit(100)

    if (filtro !== 'todos') {
      req = req.eq('status', filtro)
    }

    const { data: parcRaw } = await req
    const parc = (parcRaw || []) as any[] // Usamos as parcelas brutas para enriquecer

    // Enriquecer dados
    // supabase singleton já importado
    const lancIdsUnicos = [...new Set(parc.map((p) => p.lancamento_id))]

    const { data: lancsRaw } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, tipo, paciente_id, atendimento_id')
      .in('id', lancIdsUnicos)

    const lancs = (lancsRaw || []) as LancamentoBasico[]
    const lancMap = Object.fromEntries(lancs.map((l) => [l.id, l]))
    
    const pacienteIds = [...new Set(lancs.map((l) => l.paciente_id).filter(Boolean) as string[])]

    const { data: pacientesRaw } = pacienteIds.length > 0
      ? await supabase.from('pacientes').select('id, nome').in('id', pacienteIds)
      : { data: [] }

    const pacientes = (pacientesRaw || []) as PacienteBasico[]
    const pacienteMap = Object.fromEntries(pacientes.map((p) => [p.id, p.nome]))

    const enriquecidas = parc.map((p) => {
      const lanc = lancMap[p.lancamento_id]
      return {
        ...p,
        lancamento: lanc,
        paciente_nome: lanc?.paciente_id ? (pacienteMap[lanc.paciente_id] ?? null) : null,
      }
    }) as ParcelaComLancamento[]

    setParcelas(enriquecidas)
    setCarregando(false)
  }, [clinicaId, filtro])

  useEffect(() => { carregar() }, [carregar])

  async function handleBaixar(parcelaId: string) {
    const ok = await baixarParcela(parcelaId)
    if (ok) carregar()
  }

  const filtros: { value: FiltroStatus; label: string; cor: string }[] = [
    { value: 'pendente', label: 'Pendentes', cor: 'blue' },
    { value: 'vencido', label: 'Vencidas', cor: 'red' },
    { value: 'pago', label: 'Pagas', cor: 'green' },
    { value: 'todos', label: 'Todas', cor: 'gray' },
  ]

  const corConfig: Record<string, { ativo: string; inativo: string }> = {
    blue: { ativo: 'bg-blue-600 text-white', inativo: 'bg-gray-100 text-gray-600' },
    red: { ativo: 'bg-red-500 text-white', inativo: 'bg-gray-100 text-gray-600' },
    green: { ativo: 'bg-emerald-600 text-white', inativo: 'bg-gray-100 text-gray-600' },
    gray: { ativo: 'bg-gray-700 text-white', inativo: 'bg-gray-100 text-gray-600' },
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="flex-1 font-semibold text-gray-900">Parcelas</h1>
        {parcelas.length > 0 && (
          <span className="text-xs text-gray-400">
            Pendente: {formatarMoeda(parcelas.reduce((acc, p) => acc + p.valor - (p.valor_pago ?? 0), 0))}
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filtros.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                filtro === f.value
                  ? corConfig[f.cor].ativo
                  : corConfig[f.cor].inativo
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 px-4 pb-4">
        {carregando ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : parcelas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Filter className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">Nenhuma parcela com este filtro</p>
          </div>
        ) : (
          <div className="space-y-2">
            {parcelas.map((p) => (
              <ParcelaItem
                key={p.id}
                parcela={p}
                mostrarPaciente
                onBaixar={p.status !== 'pago' ? handleBaixar : undefined}
                onClick={p.status !== 'pago' ? () => setParcelaSelecionada(p) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal pagamento parcial */}
      {parcelaSelecionada && (
        <ModalPagamentoParcial
          parcela={parcelaSelecionada}
          onFechar={() => setParcelaSelecionada(null)}
          onSucesso={() => carregar()}
        />
      )}
    </div>
  )
}
