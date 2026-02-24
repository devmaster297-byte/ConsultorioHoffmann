// src/app/(app)/pacientes/[id]/atendimento/[atendimentoId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit2, Trash2, Scan, DollarSign, Calendar, User, Check, Clock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth.store'
import { formatarData, formatarMoeda } from '@/lib/utils'

interface Parcela {
  id: string
  numero_parcela: number
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  status: string
}

interface ParcelaRow {
  id: string
  numero_parcela: number
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  status: string
}

interface AtendimentoFull {
  id: string
  paciente_id: string
  data_atendimento: string
  procedimento_nome: string | null
  descricao: string | null
  valor_total: number | null
  dentista_nome: string | null
  total_radiografias: number
  parcelas: Parcela[]
}

interface StatusConfig {
  label: string
  bg: string
  color: string
  Icon: React.ElementType
}

const STATUS_PAG: Record<string, StatusConfig> = {
  pago:         { label: 'Pago',         bg: '#DCFCE7', color: '#166534', Icon: Check       },
  pago_parcial: { label: 'Pago parcial', bg: '#FEF9C3', color: '#854D0E', Icon: Clock       },
  pendente:     { label: 'Pendente',     bg: '#DBEAFE', color: '#1E40AF', Icon: Clock       },
  vencido:      { label: 'Vencido',      bg: '#FEE2E2', color: '#991B1B', Icon: AlertCircle },
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atendimentoId, clinicaId])

  async function carregar() {
    const supabase = createClient()

    const { data: atend } = await supabase
      .from('atendimentos')
      .select('id, paciente_id, dentista_id, data_atendimento, descricao, valor_total, procedimento:procedimentos(nome)')
      .eq('id', atendimentoId)
      .single()

    if (!atend) { router.back(); return }

    let dentistaNome: string | null = null
    if (atend.dentista_id) {
      const { data: dent } = await supabase
        .from('usuarios').select('nome').eq('id', atend.dentista_id as string).single()
      dentistaNome = (dent as { nome: string } | null)?.nome ?? null
    }

    const { count: totalRx } = await supabase
      .from('radiografias')
      .select('*', { count: 'exact', head: true })
      .eq('atendimento_id', atendimentoId)

    const { data: lancamentos } = await supabase
      .from('financeiro_lancamentos')
      .select('id')
      .eq('atendimento_id', atendimentoId)
      .eq('clinica_id', clinicaId)

    const lancIds = (lancamentos ?? []).map((l: { id: string }) => l.id)
    let parcelas: Parcela[] = []

    if (lancIds.length > 0) {
      const { data: parc } = await supabase
        .from('financeiro_parcelas')
        .select('id, numero_parcela, valor, valor_pago, data_vencimento, data_pagamento, status')
        .in('lancamento_id', lancIds)
        .order('numero_parcela')
      parcelas = ((parc ?? []) as ParcelaRow[]).map((p: ParcelaRow) => ({
        id: p.id,
        numero_parcela: p.numero_parcela,
        valor: p.valor,
        valor_pago: p.valor_pago,
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento,
        status: p.status,
      }))
    }

    setDados({
      id: atend.id as string,
      paciente_id: atend.paciente_id as string,
      data_atendimento: atend.data_atendimento as string,
      procedimento_nome: (atend.procedimento as unknown as { nome: string } | null)?.nome ?? null,
      descricao: atend.descricao as string | null,
      valor_total: atend.valor_total as number | null,
      dentista_nome: dentistaNome,
      total_radiografias: totalRx ?? 0,
      parcelas,
    })
    setCarregando(false)
  }

  async function excluir() {
    setExcluindo(true)
    const supabase = createClient()
    const { data: lancs } = await supabase
      .from('financeiro_lancamentos').select('id').eq('atendimento_id', atendimentoId)
    if (lancs?.length) {
      await supabase.from('financeiro_parcelas').delete()
        .in('lancamento_id', (lancs as { id: string }[]).map((l: { id: string }) => l.id))
      await supabase.from('financeiro_lancamentos').delete().eq('atendimento_id', atendimentoId)
    }
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

  const totalPago     = dados.parcelas
    .filter((p: Parcela) => p.status === 'pago')
    .reduce((s: number, p: Parcela) => s + (p.valor_pago ?? p.valor), 0)
  const totalPendente = dados.parcelas
    .filter((p: Parcela) => p.status !== 'pago')
    .reduce((s: number, p: Parcela) => s + p.valor, 0)

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="flex-1 font-semibold text-gray-900 truncate">
          {dados.procedimento_nome ?? 'Atendimento'}
        </h1>
        <Link href={`/pacientes/${pacienteId}/atendimento/${atendimentoId}/editar`} className="p-2 rounded-full active:bg-gray-100">
          <Edit2 className="h-4 w-4 text-gray-500" />
        </Link>
        <button onClick={() => setConfirmandoExclusao(true)} className="p-2 rounded-full active:bg-red-50">
          <Trash2 className="h-4 w-4 text-red-400" />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
            {formatarData(dados.data_atendimento)}
          </div>
          {dados.dentista_nome && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
              Dr(a). {dados.dentista_nome}
            </div>
          )}
          {dados.valor_total != null && (
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <DollarSign className="h-4 w-4 text-gray-400 flex-shrink-0" />
              {formatarMoeda(dados.valor_total)}
            </div>
          )}
          {dados.descricao && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-600 leading-relaxed">{dados.descricao}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/pacientes/${pacienteId}/radiografias?atendimento=${atendimentoId}`}
            className="flex items-center gap-2 bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50"
          >
            <Scan className="h-5 w-5 text-indigo-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Raio-X</p>
              <p className="text-xs text-gray-400">{dados.total_radiografias} imagem{dados.total_radiografias !== 1 ? 'ns' : ''}</p>
            </div>
          </Link>
          <Link
            href={`/financeiro/lancamento?atendimento=${atendimentoId}&paciente=${pacienteId}${dados.valor_total ? `&valor=${dados.valor_total}` : ''}`}
            className="flex items-center gap-2 bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50"
          >
            <DollarSign className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">Cobrança</p>
              <p className="text-xs text-gray-400">
                {dados.parcelas.length > 0 ? `${dados.parcelas.length} parcela${dados.parcelas.length !== 1 ? 's' : ''}` : 'Lançar'}
              </p>
            </div>
          </Link>
        </div>

        {dados.parcelas.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Pagamentos</p>
              <div className="flex gap-3">
                {totalPago > 0 && (
                  <div className="flex-1 bg-green-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-green-600">Recebido</p>
                    <p className="text-sm font-bold text-green-700">{formatarMoeda(totalPago)}</p>
                  </div>
                )}
                {totalPendente > 0 && (
                  <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-gray-500">Pendente</p>
                    <p className="text-sm font-bold text-gray-700">{formatarMoeda(totalPendente)}</p>
                  </div>
                )}
              </div>
            </div>

            {dados.parcelas.map((p: Parcela) => {
              const cfg: StatusConfig = STATUS_PAG[p.status] ?? STATUS_PAG.pendente
              const StatusIcon = cfg.Icon
              return (
                <div key={p.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {dados.parcelas.length > 1 ? `Parcela ${p.numero_parcela}` : 'Pagamento único'} — {formatarMoeda(p.valor)}
                      </p>
                      {p.status === 'pago' && p.data_pagamento ? (
                        <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Pago em {formatarData(p.data_pagamento)}
                          {p.valor_pago && p.valor_pago !== p.valor && (
                            <span className="text-gray-400 ml-1">({formatarMoeda(p.valor_pago)})</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">Vence {formatarData(p.data_vencimento)}</p>
                      )}
                    </div>
                    <span
                      className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {dados.parcelas.length === 0 && dados.valor_total && (
          <div className="bg-amber-50 rounded-2xl px-4 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800">Sem cobrança registrada</p>
              <p className="text-xs text-amber-600 mt-0.5">Valor: {formatarMoeda(dados.valor_total)}</p>
            </div>
            <Link
              href={`/financeiro/lancamento?atendimento=${atendimentoId}&paciente=${pacienteId}&valor=${dados.valor_total}`}
              className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-xl active:bg-amber-200"
            >
              Lançar →
            </Link>
          </div>
        )}
      </div>

      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full bg-white rounded-t-2xl p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Excluir atendimento?</h2>
            <p className="text-sm text-gray-500">
              Esta ação não pode ser desfeita. As cobranças e parcelas vinculadas também serão removidas.
            </p>
            <button
              onClick={excluir} disabled={excluindo}
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