// src/app/(app)/financeiro/lancamento/page.tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ChevronDown, Search, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { criarLancamento } from '@/lib/hooks/useFinanceiro'
import { formatarMoeda } from '@/lib/utils'

const schema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  descricao: z.string().min(2, 'Descrição obrigatória'),
  valor_total: z.string().min(1, 'Valor obrigatório'),
  num_parcelas: z.number().min(1).max(60),
  primeiro_vencimento: z.string().min(1, 'Data obrigatória'),
})

type FormData = z.infer<typeof schema>

interface PacienteSugestao {
  id: string
  nome: string
}

function LancamentoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { clinicaId } = useAuthStore()

  const pacienteIdParam    = searchParams.get('paciente')
  const atendimentoIdParam = searchParams.get('atendimento')
  const orcamentoIdParam   = searchParams.get('orcamento')
  const valorParam         = searchParams.get('valor')
  const descricaoParam     = searchParams.get('descricao')

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pacienteSelecionado, setPacienteSelecionado] = useState<PacienteSugestao | null>(null)
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [sugestoes, setSugestoes] = useState<PacienteSugestao[]>([])
  const [mostrarBusca, setMostrarBusca] = useState(false)
  const [previewParcelas, setPreviewParcelas] = useState<{ numero: number; valor: number; vencimento: string }[]>([])

  const hoje = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, watch, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: 'receita',
      num_parcelas: 1,
      primeiro_vencimento: hoje,
    },
  })

  const [valorTotal, numParcelas, primeiroVencimento, tipo] = watch([
    'valor_total',
    'num_parcelas',
    'primeiro_vencimento',
    'tipo',
  ])

  // Pré-preencher campos vindos de orçamento ou atendimento (com decode correto)
  useEffect(() => {
    if (valorParam)     setValue('valor_total', valorParam)
    if (descricaoParam) setValue('descricao', decodeURIComponent(descricaoParam))
  }, [valorParam, descricaoParam, setValue])

  // Carregar paciente pré-selecionado
  useEffect(() => {
    if (!pacienteIdParam) return
    async function buscarPaciente() {
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome')
        .eq('id', pacienteIdParam)
        .single()
      if (data) setPacienteSelecionado(data)
    }
    buscarPaciente()
  }, [pacienteIdParam])

  // Gerar preview das parcelas
  useEffect(() => {
    const valor = parseFloat(valorTotal)
    const parcelas = numParcelas ?? 1
    if (!valor || !primeiroVencimento || parcelas < 1) {
      setPreviewParcelas([])
      return
    }

    const valorParcela = Number((valor / parcelas).toFixed(2))
    const preview = Array.from({ length: Math.min(parcelas, 6) }, (_, i) => {
      const d = new Date(primeiroVencimento)
      d.setMonth(d.getMonth() + i)
      const isUltima = i === parcelas - 1
      const valorFinal = isUltima
        ? Number((valor - valorParcela * (parcelas - 1)).toFixed(2))
        : valorParcela
      return {
        numero: i + 1,
        valor: valorFinal,
        vencimento: d.toISOString().split('T')[0],
      }
    })

    setPreviewParcelas(preview)
  }, [valorTotal, numParcelas, primeiroVencimento])

  // Busca de paciente em tempo real
  useEffect(() => {
    if (!buscaPaciente.trim() || !clinicaId) {
      setSugestoes([])
      return
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome')
        .eq('clinica_id', clinicaId)
        .ilike('nome', `%${buscaPaciente}%`)
        .limit(6)
      setSugestoes(data ?? [])
    }, 250)
    return () => clearTimeout(timeout)
  }, [buscaPaciente, clinicaId])

  async function onSubmit(data: FormData) {
    if (!clinicaId) return
    setSalvando(true)
    setErro(null)

    const resultado = await criarLancamento({
      clinicaId,
      pacienteId: pacienteSelecionado?.id ?? pacienteIdParam ?? undefined,
      atendimentoId: atendimentoIdParam ?? undefined,
      orcamentoId: orcamentoIdParam ?? undefined,
      tipo: data.tipo,
      descricao: data.descricao,
      valorTotal: parseFloat(data.valor_total),
      numParcelas: data.num_parcelas,
      primeiroVencimento: data.primeiro_vencimento,
    })

    if (!resultado.sucesso) {
      setErro(resultado.erro ?? 'Erro ao salvar')
      setSalvando(false)
      return
    }

    // Voltar para a origem
    if (pacienteIdParam) {
      router.push(`/pacientes/${pacienteIdParam}`)
    } else {
      router.push('/financeiro')
    }
  }

  function formatarDataBr(data: string) {
    if (!data) return ''
    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}/${ano}`
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">{orcamentoIdParam ? "Cobrança do Orçamento" : "Novo Lançamento"}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 px-4 py-5 space-y-4">
        {/* Tipo: receita / despesa */}
        <div className="grid grid-cols-2 gap-2 bg-gray-100 rounded-2xl p-1">
          {(['receita', 'despesa'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setValue('tipo', t)}
              className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                tipo === t
                  ? t === 'receita'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'bg-white text-red-500 shadow-sm'
                  : 'text-gray-400'
              }`}
            >
              {t === 'receita' ? '↑ Receita' : '↓ Despesa'}
            </button>
          ))}
        </div>

        {/* Campos principais */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          {/* Paciente (apenas para receita) */}
          {tipo === 'receita' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Paciente</label>
              {pacienteSelecionado ? (
                <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{pacienteSelecionado.nome}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPacienteSelecionado(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar paciente..."
                      value={buscaPaciente}
                      onChange={(e) => {
                        setBuscaPaciente(e.target.value)
                        setMostrarBusca(true)
                      }}
                      onFocus={() => setMostrarBusca(true)}
                      className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  {mostrarBusca && sugestoes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                      {sugestoes.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPacienteSelecionado(p)
                            setBuscaPaciente('')
                            setMostrarBusca(false)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        >
                          <UserRound className="h-4 w-4 text-gray-300 flex-shrink-0" />
                          {p.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Descrição *</label>
            <input
              {...register('descricao')}
              type="text"
              placeholder={tipo === 'receita' ? 'Tratamento, consulta...' : 'Aluguel, material...'}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {errors.descricao && (
              <p className="mt-1 text-xs text-red-500">{errors.descricao.message}</p>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Valor total *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                R$
              </span>
              <input
                {...register('valor_total')}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {errors.valor_total && (
              <p className="mt-1 text-xs text-red-500">{errors.valor_total.message}</p>
            )}
          </div>
        </div>

        {/* Parcelamento */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Parcelamento
          </p>

          {/* Número de parcelas */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Número de parcelas
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {[1, 2, 3, 4, 6, 8, 10, 12].map((n) => (
                <Controller
                  key={n}
                  name="num_parcelas"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(n)}
                      className={`flex-shrink-0 h-10 w-10 rounded-xl text-sm font-medium transition-colors ${
                        field.value === n
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                      }`}
                    >
                      {n}x
                    </button>
                  )}
                />
              ))}
            </div>
          </div>

          {/* Primeiro vencimento */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Primeiro vencimento
            </label>
            <input
              {...register('primeiro_vencimento')}
              type="date"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Preview das parcelas */}
          {previewParcelas.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-gray-400">Preview:</p>
              {previewParcelas.map((p) => (
                <div
                  key={p.numero}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0"
                >
                  <span className="text-gray-500">
                    {p.numero}/{numParcelas} · {formatarDataBr(p.vencimento)}
                  </span>
                  <span className="font-semibold text-gray-800">{formatarMoeda(p.valor)}</span>
                </div>
              ))}
              {numParcelas > 6 && (
                <p className="text-xs text-gray-400 text-center">
                  + {numParcelas - 6} parcelas...
                </p>
              )}
            </div>
          )}
        </div>

        {erro && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
        )}

        <div className="pb-6">
          <button
            type="submit"
            disabled={salvando}
            className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60 active:bg-blue-700 transition-colors"
          >
            {salvando ? 'Salvando...' : 'Salvar Lançamento'}
          </button>
        </div>
      </form>
    </div>
  )
}
export default function LancamentoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    }>
      <LancamentoContent />
    </Suspense>
  )
}