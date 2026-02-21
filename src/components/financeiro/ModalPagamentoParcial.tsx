// src/components/financeiro/ModalPagamentoParcial.tsx
'use client'

import { useState } from 'react'
import { X, DollarSign } from 'lucide-react'
import { ParcelaComLancamento, baixarParcela } from '@/lib/hooks/useFinanceiro'
import { formatarMoeda, formatarData } from '@/lib/utils'

interface Props {
  parcela: ParcelaComLancamento
  onFechar: () => void
  onSucesso: () => void
}

export function ModalPagamentoParcial({ parcela, onFechar, onSucesso }: Props) {
  const saldoDevedor = parcela.valor - (parcela.valor_pago ?? 0)
  const [valor, setValor] = useState(saldoDevedor.toFixed(2))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSalvar() {
    const valorNum = parseFloat(valor)
    if (!valorNum || valorNum <= 0) {
      setErro('Informe um valor válido')
      return
    }
    if (valorNum > saldoDevedor) {
      setErro(`Valor máximo: ${formatarMoeda(saldoDevedor)}`)
      return
    }

    setSalvando(true)
    const ok = await baixarParcela(parcela.id, valorNum)
    setSalvando(false)

    if (ok) {
      onSucesso()
      onFechar()
    } else {
      setErro('Erro ao registrar pagamento')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onFechar} />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white pb-safe">
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold text-gray-900">Registrar Pagamento</h2>
          <button onClick={onFechar} className="p-1 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="px-4 pb-6 space-y-4">
          {/* Info da parcela */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-sm font-medium text-gray-800">
              {parcela.lancamento?.descricao}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Vence {formatarData(parcela.data_vencimento)}
              {parcela.numero > 1 && ` · Parcela ${parcela.numero}`}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Saldo devedor: <span className="font-semibold text-gray-800">{formatarMoeda(saldoDevedor)}</span>
            </p>
          </div>

          {/* Valor pago */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Valor recebido (R$)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={saldoDevedor}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3.5 text-base font-bold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {parseFloat(valor) < saldoDevedor && parseFloat(valor) > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Restará {formatarMoeda(saldoDevedor - parseFloat(valor))} em aberto
              </p>
            )}
          </div>

          {/* Atalhos de valor */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setValor(saldoDevedor.toFixed(2))}
              className="flex-1 rounded-xl bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-700 active:bg-emerald-100"
            >
              Total ({formatarMoeda(saldoDevedor)})
            </button>
            <button
              type="button"
              onClick={() => setValor((saldoDevedor / 2).toFixed(2))}
              className="flex-1 rounded-xl bg-gray-100 py-2.5 text-xs font-medium text-gray-600 active:bg-gray-200"
            >
              Metade
            </button>
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>
          )}

          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-semibold text-white disabled:opacity-60 active:bg-emerald-700 transition-colors"
          >
            <DollarSign className="h-4 w-4" />
            {salvando ? 'Registrando...' : 'Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </>
  )
}
