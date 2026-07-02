// src/lib/dentistas.ts
// ─── Fonte única da verdade para a lista de dentistas da clínica ─────────────
// Para adicionar ou renomear um dentista, edite APENAS este arquivo.
// Todos os outros arquivos importam daqui.

export const DENTISTAS = [
  {
    key:      'rosieli',
    nome:     'Drª Rosieli Hoffmann',
    nomeLong: 'Drª Rosieli D. Hoffmann',
    initials: 'RH',
    cor:      'bg-purple-100 text-purple-700 border-purple-200',
  },
  {
    key:      'eduardo',
    nome:     'Drº Eduardo Corteletti',
    nomeLong: 'Drº Eduardo Corteletti',
    initials: 'EC',
    cor:      'bg-blue-100 text-blue-700 border-blue-200',
  },
  {
    key:      'pamela',
    nome:     'Drª Pamela Bolsoni',
    nomeLong: 'Drª Pamela Bolsoni',
    initials: 'PB',
    cor:      'bg-rose-100 text-rose-700 border-rose-200',
  },
] as const

export type DentistaKey = typeof DENTISTAS[number]['key']

/** Dentista padrão quando nenhum prefixo está na descrição */
export const DENTISTA_DEFAULT: DentistaKey = 'rosieli'

/** Retorna o objeto do dentista pelo key, ou o padrão se não encontrado */
export function getDentista(key: string) {
  return DENTISTAS.find(d => d.key === key) ?? DENTISTAS[0]
}

/**
 * Extrai o key do dentista a partir da descrição de um lançamento.
 * Suporta ambos os formatos:
 *   Avulso:    "[eduardo] Manutenção"
 *   Orçamento: "[orc:UUID][pamela] Proc1, Proc2"
 */
export function extrairDentistaKey(descricao: string): DentistaKey {
  const tags = [...descricao.matchAll(/\[([a-z]+)\]/g)]
  for (const m of tags) {
    if (DENTISTAS.find(d => d.key === m[1])) return m[1] as DentistaKey
  }
  return DENTISTA_DEFAULT
}

/**
 * Mapa chave → nome longo para dentistas não-Rosieli.
 * Compatibilidade com useAtendimentos.ts que busca nome pelo prefixo da descrição.
 */
export const DENTISTAS_EXTERNOS: Record<string, string> = Object.fromEntries(
  DENTISTAS
    .filter(d => d.key !== DENTISTA_DEFAULT)
    .map(d => [d.key, d.nome])
)