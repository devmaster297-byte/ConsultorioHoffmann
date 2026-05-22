// src/app/(app)/layout.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, History, Scan, DollarSign, Settings, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'
import { useVencidosCount } from '@/lib/hooks/useVencidosCount'

const NAV = [
  { href: '/pacientes',     icon: Users,      label: 'Pacientes'  },
  { href: '/historico',     icon: History,    label: 'Histórico'  },
  { href: '/radiografias',  icon: Scan,       label: 'Raio-X'     },
  { href: '/financeiro',    icon: DollarSign, label: 'Financeiro' },
  { href: '/configuracoes', icon: Settings,   label: 'Config.'    },
]

function BuscaGlobal({ onFechar }: { onFechar: () => void }) {
  const router = useRouter()
  const { clinicaId } = useAuthStore()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<{ id: string; nome: string; telefone: string | null }[]>([])
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (query.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome, telefone')
        .eq('clinica_id', clinicaId)
        .ilike('nome', `%${query}%`)
        .limit(8)
      setResultados((data ?? []) as { id: string; nome: string; telefone: string | null }[])
      setBuscando(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query, clinicaId])

  function irParaPaciente(id: string) {
    onFechar()
    router.push(`/pacientes/${id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar paciente pelo nome..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 text-base text-gray-900 placeholder-gray-400 outline-none"
        />
        <button onClick={onFechar} className="p-1.5 rounded-full hover:bg-gray-100 flex-shrink-0">
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {buscando && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
          </div>
        )}

        {!buscando && query.length >= 2 && resultados.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium text-gray-600">Nenhum paciente encontrado</p>
            <p className="text-sm text-gray-400 mt-1">para &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {!buscando && resultados.length > 0 && (
          <div>
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {resultados.length} paciente{resultados.length !== 1 ? 's' : ''} encontrado{resultados.length !== 1 ? 's' : ''}
            </p>
            {resultados.map((p, i) => (
              <button
                key={p.id}
                onClick={() => irParaPaciente(p.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 active:bg-gray-100 ${
                  i < resultados.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                  {p.nome.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{p.nome}</p>
                  {p.telefone && <p className="text-xs text-gray-400 mt-0.5">{p.telefone}</p>}
                </div>
                <span className="text-xs text-blue-600 font-medium flex-shrink-0">Ver ficha →</span>
              </button>
            ))}
          </div>
        )}

        {query.length < 2 && !buscando && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-sm text-gray-400">Digite o nome do paciente para buscar</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { clinicaId } = useAuthStore()
  const [buscaAberta, setBuscaAberta] = useState(false)
  const vencidosCount = useVencidosCount(clinicaId)

  const activeRoute = NAV.find(n =>
    pathname === n.href || pathname.startsWith(n.href + '/')
  )?.href

  useEffect(() => { setBuscaAberta(false) }, [pathname])

  return (
    <div className="flex flex-col h-dvh" style={{ background: 'var(--hf-cream)' }}>

      <header
        className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b"
        style={{ background: 'var(--hf-white)', borderColor: 'var(--hf-gray-200)' }}
      >
        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
          <p style={{ fontSize: 20, fontWeight: 500, letterSpacing: '0.18em', color: 'var(--hf-black)', margin: 0, lineHeight: 1 }}>HOFFMANN</p>
          <p style={{ fontSize: 8, letterSpacing: '0.2em', color: 'var(--hf-gray-400)', margin: 0, marginTop: 2, fontFamily: 'DM Sans, sans-serif', fontWeight: 300 }}>CLÍNICA ODONTOLÓGICA E ESTÉTICA</p>
        </div>

        <button
          onClick={() => setBuscaAberta(true)}
          className="flex items-center gap-2 bg-gray-100 rounded-full px-3.5 py-2 hover:bg-gray-200 active:bg-gray-200 transition-colors"
        >
          <Search className="h-4 w-4 text-gray-500" />
          <span className="text-xs text-gray-400">Buscar paciente</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      <nav
        className="flex-shrink-0 border-t"
        style={{
          background: 'var(--hf-white)',
          borderColor: 'var(--hf-gray-200)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = activeRoute === href
            const showBadge = href === '/financeiro' && vencidosCount > 0

            return (
              <Link key={href} href={href}
                className="flex-1 flex flex-col items-center gap-1 py-3 relative transition-colors"
                style={{ color: active ? 'var(--hf-gold)' : 'var(--hf-gray-400)' }}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] rounded-full bg-red-500 flex items-center justify-center px-0.5">
                      <span className="text-white font-bold" style={{ fontSize: 9 }}>
                        {vencidosCount > 9 ? '9+' : vencidosCount}
                      </span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-wide" style={{ fontWeight: active ? 600 : 400 }}>
                  {label}
                </span>
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                    style={{ background: 'var(--hf-gold)' }}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {buscaAberta && <BuscaGlobal onFechar={() => setBuscaAberta(false)} />}
    </div>
  )
}
