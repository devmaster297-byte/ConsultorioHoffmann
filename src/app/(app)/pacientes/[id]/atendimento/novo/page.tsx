// src/app/(app)/pacientes/[id]/atendimento/[atendimentoId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit2, Trash2, Scan, DollarSign, Calendar, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { formatarData, formatarMoeda } from '@/lib/utils'

interface AtendimentoFull {
  id: string
  paciente_id: string
  data_atendimento: string
  procedimento_nome: string | null
  descricao: string | null
  valor_total: number | null
  dentista_nome: string | null
  total_radiografias: number
  parcelas: Array<{
    id: string
    numero: number
    valor: number
    data_vencimento: string
    status: string
    valor_pago: number | null
  }>
}

const statusPagConfig: Record<string, { label: string; className: string }> = {
  pago: { label: 'Pago', className: 'text-emerald-700 bg-emerald-50' },
  pago_parcial: { label: 'Pago parcial', className: 'text-amber-700 bg-amber-50' },
  pendente: { label: 'Pendente', className: 'text-blue-700 bg-blue-50' },
  vencido: { label: 'Vencido', className: 'text-red-700 bg-red-50' },
}

export default function DetalheAtendimentoPage() {
  const { id: pacienteId, atendimentoId } = useParams<{ id: string; atendimentoId: string }>()
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const [dados, setDados] = useState<AtendimentoFull | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    if (!atendimentoId || !clinicaId) return
    carregar()
  }, [atendimentoId, clinicaId])

  async function carregar() {
    const supabase = createClient()

    const { data: atend } = await supabase
      .from('atendimentos')
      .select(`
        id,
        paciente_id,
        data_atendimento,
        descricao,
        valor_total,
        procedimento:procedimentos(nome),
        dentista:usuarios(nome)
      `)
      .eq('id', atendimentoId)
      .single()

    if (!atend) {
      router.back()
      return
    }

    // Buscar radiografias
    const { count: totalRx } = await supabase
      .from('radiografias')
      .select('*', { count: 'exact', head: true })
      .eq('atendimento_id', atendimentoId)

    // Buscar parcelas via lançamentos
    const { data: lancamentos } = await supabase
      .from('financeiro_lancamentos')
      .select('id')
      .eq('atendimento_id', atendimentoId)
      .eq('clinica_id', clinicaId)

    const lancIds = lancamentos?.map((l) => l.id) ?? []
    let parcelas: AtendimentoFull['parcelas'] = []

    if (lancIds.length > 0) {
      const { data: parc } = await supabase
        .from('financeiro_parcelas')
        .select('id, numero, valor, data_vencimento, status, valor_pago')
        .in('lancamento_id', lancIds)
        .order('numero')

      parcelas = parc ?? []
    }

    setDados({
      id: atend.id,
      paciente_id: atend.paciente_id,
      data_atendimento: atend.data_atendimento,
      procedimento_nome: (atend.procedimento as unknown as { nome: string } | null)?.nome ?? null,
      descricao: atend.descricao,
      valor_total: atend.valor_total,
      dentista_nome: (atend.dentista as unknown as { nome: string } | null)?.nome ?? null,
      total_radiografias: totalRx ?? 0,
      parcelas,
    })
    setCarregando(false)
  }

  async function excluir() {
    setExcluindo(true)
    const supabase = createClient()
    await supabase.from('atendimentos').delete().eq('id', atendimentoId)
    router.push(`/pacientes/${pacienteId}`)
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!dados) return null

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="flex-1 font-semibold text-gray-900 truncate">
          {dados.procedimento_nome ?? 'Atendimento'}
        </h1>
        <Link
          href={`/pacientes/${pacienteId}/atendimento/${atendimentoId}/editar`}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <Edit2 className="h-4 w-4 text-gray-500" />
        </Link>
        <button
          onClick={() => setConfirmandoExclusao(true)}
          className="p-2 rounded-full hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 text-red-400" />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Info principal */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="h-4 w-4 text-gray-400" />
            {formatarData(dados.data_atendimento)}
          </div>
          {dados.dentista_nome && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <User className="h-4 w-4 text-gray-400" />
              Dr(a). {dados.dentista_nome}
            </div>
          )}
          {dados.valor_total != null && (
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <DollarSign className="h-4 w-4 text-gray-400" />
              {formatarMoeda(dados.valor_total)}
            </div>
          )}
          {dados.descricao && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-600 leading-relaxed">{dados.descricao}</p>
            </div>
          )}
        </div>

        {/* Ações rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/pacientes/${pacienteId}/radiografias?atendimento=${atendimentoId}`}
            className="flex items-center gap-2 bg-white rounded-xl p-4 shadow-sm active:bg-gray-50"
          >
            <Scan className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Raio-X</p>
              <p className="text-xs text-gray-400">{dados.total_radiografias} imagem{dados.total_radiografias !== 1 ? 'ns' : ''}</p>
            </div>
          </Link>
          <Link
            href={`/financeiro/lancamento?atendimento=${atendimentoId}&paciente=${pacienteId}`}
            className="flex items-center gap-2 bg-white rounded-xl p-4 shadow-sm active:bg-gray-50"
          >
            <DollarSign className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Cobrança</p>
              <p className="text-xs text-gray-400">{dados.parcelas.length} parcela{dados.parcelas.length !== 1 ? 's' : ''}</p>
            </div>
          </Link>
        </div>

        {/* Parcelas */}
        {dados.parcelas.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Pagamentos
              </p>
            </div>
            {dados.parcelas.map((p) => {
              const cfg = statusPagConfig[p.status] ?? statusPagConfig.pendente
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Parcela {p.numero} — {formatarMoeda(p.valor)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Vence {formatarData(p.data_vencimento)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal confirmação exclusão */}
      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full bg-white rounded-t-2xl p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Excluir atendimento?</h2>
            <p className="text-sm text-gray-500">
              Esta ação não pode ser desfeita. As cobranças vinculadas também serão removidas.
            </p>
            <button
              onClick={excluir}
              disabled={excluindo}
              className="w-full rounded-xl bg-red-600 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {excluindo ? 'Excluindo...' : 'Sim, excluir'}
            </button>
            <button
              onClick={() => setConfirmandoExclusao(false)}
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