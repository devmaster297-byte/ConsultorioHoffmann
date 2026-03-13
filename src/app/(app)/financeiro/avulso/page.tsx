// src/app/(app)/financeiro/avulso/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'

// Dentistas fixos da clínica
const DENTISTAS = [
  { id: 'rosiele', nome: 'Drª Rosiele Hoffmann',  initials: 'RH' },
  { id: 'eduardo', nome: 'Drº Eduardo Cortelleti', initials: 'EC' },
]

const FORMAS = [
  { id: 'pix',            label: 'PIX',         emoji: '📱' },
  { id: 'dinheiro',       label: 'Dinheiro',    emoji: '💵' },
  { id: 'cartao_credito', label: 'Crédito',     emoji: '💳' },
  { id: 'cartao_debito',  label: 'Débito',      emoji: '💳' },
  { id: 'transferencia',  label: 'Transferência', emoji: '🏦' },
  { id: 'boleto',         label: 'Boleto',      emoji: '📄' },
]

export default function PagamentoAvulsoPage() {
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const hoje = new Date().toISOString().split('T')[0]

  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState('pix')
  const [data, setData] = useState(hoje)
  const [dentistaKey, setDentistaKey] = useState<string>('rosiele')
  const [pacienteNome, setPacienteNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Busca paciente por nome para vincular ao lançamento (opcional)
  const [pacientes, setPacientes] = useState<{ id: string; nome: string }[]>([])
  const [pacienteId, setPacienteId] = useState<string | null>(null)
  const [buscandoPaciente, setBuscandoPaciente] = useState(false)

  async function buscarPaciente(nome: string) {
    setPacienteNome(nome)
    setPacienteId(null)
    if (nome.length < 2) { setPacientes([]); return }
    setBuscandoPaciente(true)
    const { data } = await supabase
      .from('pacientes')
      .select('id, nome')
      .eq('clinica_id', clinicaId)
      .ilike('nome', `%${nome}%`)
      .limit(5)
    setPacientes((data ?? []) as { id: string; nome: string }[])
    setBuscandoPaciente(false)
  }

  function selecionarPaciente(p: { id: string; nome: string }) {
    setPacienteId(p.id)
    setPacienteNome(p.nome)
    setPacientes([])
  }

  async function salvar() {
    const valorNum = parseFloat(valor)
    if (!descricao.trim()) { setErro('Informe uma descrição'); return }
    if (!valorNum || valorNum <= 0) { setErro('Informe um valor válido'); return }
    if (!clinicaId) { setErro('Sessão expirada'); return }

    setSalvando(true)
    setErro(null)

    // Prefixo [key] sempre incluído para rastreio de comissão
    const descFinal = `[${dentistaKey}] ${descricao.trim()}`

    // Criar lançamento
    const { data: lanc, error: lancErr } = await supabase
      .from('financeiro_lancamentos')
      .insert({
        clinica_id: clinicaId,
        paciente_id: pacienteId ?? null,
        tipo: 'receita',
        descricao: descFinal,
        valor_total: valorNum,
        num_parcelas: 1,
      })
      .select('id')
      .single()

    if (lancErr || !lanc) {
      setErro('Erro ao criar lançamento'); setSalvando(false); return
    }

    // Criar parcela já como paga
    const { error: parErr } = await supabase
      .from('financeiro_parcelas')
      .insert({
        lancamento_id: (lanc as { id: string }).id,
        clinica_id: clinicaId,
        numero: 1,
        valor: valorNum,
        valor_pago: valorNum,
        data_vencimento: data,
        data_pagamento: data,
        status: 'pago',
      })

    if (parErr) {
      await supabase.from('financeiro_lancamentos').delete().eq('id', (lanc as { id: string }).id)
      setErro('Erro ao registrar pagamento'); setSalvando(false); return
    }

    router.push('/financeiro')
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="font-semibold text-gray-900">Pagamento Avulso</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manutenção, consulta rápida ou outro serviço</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Descrição *
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Manutenção aparelho, consulta de retorno..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Valor */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Valor (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-base font-bold text-gray-900 focus:border-blue-500 focus:outline-none"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Dentista */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Dentista
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DENTISTAS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDentistaKey(d.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                    dentistaKey === d.id
                      ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold'
                      : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    dentistaKey === d.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {d.initials}
                  </div>
                  <span className="text-xs leading-tight text-left">{d.nome}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Forma de pagamento */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setForma(f.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 transition-all ${
                    forma === f.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-lg">{f.emoji}</span>
                  <span className={`text-xs font-medium ${forma === f.id ? 'text-blue-700' : 'text-gray-600'}`}>
                    {f.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Data do Pagamento
            </label>
            <input
              type="date"
              value={data}
              max={hoje}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Paciente (opcional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Paciente <span className="text-gray-400 font-normal normal-case">(opcional)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={pacienteNome}
                onChange={(e) => buscarPaciente(e.target.value)}
                placeholder="Digite o nome para buscar..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
              />
              {pacienteId && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-lg">✓</span>
              )}
            </div>

            {/* Autocomplete */}
            {pacientes.length > 0 && (
              <div className="mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-10">
                {pacientes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selecionarPaciente(p)}
                    className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
            )}
            {buscandoPaciente && (
              <p className="text-xs text-gray-400 mt-1">Buscando...</p>
            )}
          </div>
        </div>

        {erro && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
        )}

        <div className="pb-8">
          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-semibold text-white disabled:opacity-50 active:bg-blue-700"
          >
            {salvando ? 'Salvando...' : '✓ Registrar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
