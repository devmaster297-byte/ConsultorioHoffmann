// src/components/shared/ReleaseNotesModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Users, PartyPopper } from 'lucide-react'

// Da próxima vez que tiver novidade pra avisar, só trocar o texto abaixo e
// mudar esse identificador (ex: '2026-09-nova-funcao') — o aviso volta a
// aparecer mais 3 vezes pra todo mundo, mesmo quem já viu o anúncio anterior.
const IDENTIFICADOR_AVISO = '2026-08-pagamentos-lista-pacientes'
const VEZES_PARA_MOSTRAR = 3
const CHAVE_ARMAZENAMENTO = `hf_aviso_visto:${IDENTIFICADOR_AVISO}`

export function ReleaseNotesModal() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const vezesJaMostrado = Number(window.localStorage.getItem(CHAVE_ARMAZENAMENTO) ?? '0')

    if (vezesJaMostrado < VEZES_PARA_MOSTRAR) {
      setVisivel(true)
      window.localStorage.setItem(CHAVE_ARMAZENAMENTO, String(vezesJaMostrado + 1))
    }
  }, [])

  if (!visivel) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) setVisivel(false) }}
    >
      <div className="w-full bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 80px)' }}>
        {/* Cabeçalho */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-6 pb-4 border-b border-gray-100">
          <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--hf-cream)' }}>
            <PartyPopper className="h-5 w-5" style={{ color: 'var(--hf-gold)' }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Novidades no sistema</h2>
            <p className="text-xs text-gray-400 mt-0.5">Duas melhorias que fizemos essa semana</p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div className="flex gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Pagamentos mais seguros</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Corrigimos um detalhe no registro de pagamentos: agora o sistema sempre confirma que o
                valor recebido do paciente foi salvo certinho. Também resolvemos um caso em que o mesmo
                orçamento podia aparecer cobrado duas vezes na tela financeira.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Lista de pacientes completa</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                A lista de pacientes estava parando de carregar depois dos primeiros 50 nomes ao rolar a
                tela. Agora ela carrega todos os pacientes normalmente, do primeiro ao último.
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center pt-1">
            Esse aviso vai aparecer só mais algumas vezes e depois some sozinho.
          </p>
        </div>

        {/* Rodapé */}
        <div
          className="flex-shrink-0 px-5 pt-3 border-t border-gray-100 bg-white"
          style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))' }}
        >
          <button
            onClick={() => setVisivel(false)}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white active:bg-blue-700"
          >
            Entendi, obrigado!
          </button>
        </div>
      </div>
    </div>
  )
}
