// src/app/(app)/configuracoes/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardList, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/store/auth.store'

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { setUsuario } = useAuthStore()

  async function sair() {
    await supabase.auth.signOut()
    setUsuario(null)
    router.push('/login')
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="font-semibold text-gray-900">Configurações</h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        <Link
          href="/configuracoes/procedimentos"
          className="flex items-center gap-3 bg-white rounded-xl px-4 py-4 shadow-sm active:bg-gray-50"
        >
          <ClipboardList className="h-5 w-5 text-blue-500" />
          <div>
            <p className="font-medium text-gray-900">Procedimentos</p>
            <p className="text-xs text-gray-400 mt-0.5">Gerencie os procedimentos e valores padrão</p>
          </div>
        </Link>

        <button
          onClick={sair}
          className="flex w-full items-center gap-3 bg-white rounded-xl px-4 py-4 shadow-sm active:bg-red-50"
        >
          <LogOut className="h-5 w-5 text-red-400" />
          <p className="font-medium text-red-500">Sair</p>
        </button>
      </div>
    </div>
  )
}
