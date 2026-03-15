// src/app/(app)/financeiro/exportar/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, FileSpreadsheet, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { exportarMensal } from '@/lib/exportar-mensal'

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export default function ExportarPage() {
  const router = useRouter()
  const { clinicaId } = useAuthStore()

  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1) // 1-indexed
  const [exportando, setExportando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleExportar() {
    if (!clinicaId) { setErro('Sessão expirada'); return }
    setExportando(true)
    setErro(null)
    setConcluido(false)

    try {
      const mesStr = `${ano}-${String(mes).padStart(2, '0')}`
      await exportarMensal(clinicaId, mesStr)
      setConcluido(true)
      setTimeout(() => setConcluido(false), 4000)
    } catch (e) {
      setErro('Erro ao gerar planilha. Tente novamente.')
      console.error(e)
    } finally {
      setExportando(false)
    }
  }

  // Anos disponíveis (2023 até ano atual)
  const anosDisponiveis = Array.from(
    { length: hoje.getFullYear() - 2022 },
    (_, i) => 2023 + i
  )

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="font-semibold text-gray-900">Exportar Planilha</h1>
          <p className="text-xs text-gray-400 mt-0.5">Acompanhamento mensal de pacientes</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-4">

        {/* Ícone */}
        <div className="flex flex-col items-center py-6">
          <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3">
            <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Planilha Excel mensal</p>
          <p className="text-xs text-gray-400 mt-1 text-center max-w-xs">
            Gera arquivo .xlsx com duas abas: uma para a Drª Rosiele e outra para o Dr. Eduardo,
            no mesmo formato do histórico da clínica.
          </p>
        </div>

        {/* Seletor de mês e ano */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Período</p>

          {/* Mês */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mês</label>
            <div className="grid grid-cols-4 gap-2">
              {MESES_PT.map((nome, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMes(i + 1)}
                  disabled={ano === hoje.getFullYear() && i + 1 > hoje.getMonth() + 1}
                  className={`rounded-xl border py-2 text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                    mes === i + 1
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {nome.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Ano */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
            <div className="flex gap-2">
              {anosDisponiveis.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAno(a)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all ${
                    ano === a
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview do que será exportado */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Conteúdo da planilha</p>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">RH</div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Aba: Drª Rosiele</p>
              <p className="text-xs text-gray-400">Todos os pacientes com lançamentos atribuídos a ela</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">EC</div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Aba: Dr. Eduardo</p>
              <p className="text-xs text-gray-400">Todos os pacientes com lançamentos atribuídos a ele</p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 leading-relaxed">
              Cada aba contém: Paciente · Tratamento · Valor total · Tipo de pagamento ·
              Valor pago no mês · Data do pagamento · Valor pendente.
              Inclui totais automáticos ao final.
            </p>
          </div>
        </div>

        {erro && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
        )}

        {concluido && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-700">
              Planilha gerada! Verifique seus downloads.
            </p>
          </div>
        )}

        <button
          onClick={handleExportar}
          disabled={exportando}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-semibold text-white disabled:opacity-50 active:bg-emerald-700"
        >
          <Download className="h-5 w-5" />
          {exportando
            ? 'Gerando planilha...'
            : `Exportar ${MESES_PT[mes - 1]} ${ano}`}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          O arquivo será salvo como <strong>pacientes_{`${ano}-${String(mes).padStart(2, '0')}`}_hoffmann.xlsx</strong>
        </p>
      </div>
    </div>
  )
}
