// src/lib/exportar-mensal.ts
// Gera planilha Excel mensal no formato histórico da clínica.
// Usa SheetJS (xlsx) — adicionar ao package.json: "xlsx": "^0.18.5"

import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase-browser'

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const CABECALHO = [
  'PACIENTE',
  'TRATAMENTO',
  'VALOR TOTAL TRATAMENTO',
  'Tipo de Pagamento',
  'VALOR PAGO',
  'Data do Pagamento',
  'VALOR PENDENTE',
]

const FORMA_LABEL: Record<string, string> = {
  pix:            'PIX',
  dinheiro:       'Dinheiro',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito:  'Cartão de Débito',
  transferencia:  'Transferência',
  boleto:         'Boleto',
  cheque:         'Cheque',
  outros:         'Outros',
}

// Dentistas reconhecidos — chave deve bater com o prefixo gravado na descrição
// (ex.: "[eduardo] Proc" ou "[pamela] Proc")
const DENTISTAS = ['rosieli', 'eduardo', 'pamela'] as const
type DentistaKey = typeof DENTISTAS[number]

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface LinhaExport {
  paciente:      string
  tratamento:    string
  valorTotal:    number
  tipoPagto:     string
  valorPago:     number
  dataPagto:     string
  valorPendente: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function limparDescricao(descricao: string): string {
  return descricao
    .replace(/\[orc:[a-f0-9-]{36}\]/g, '')
    .replace(/\[[a-z]+\]/g, '')
    .trim()
}

function extrairDentista(descricao: string): DentistaKey {
  const tags = [...descricao.matchAll(/\[([a-z]+)\]/g)]
  for (const m of tags) {
    if ((DENTISTAS as readonly string[]).includes(m[1])) return m[1] as DentistaKey
  }
  return 'rosieli' // padrão quando não há prefixo
}

function formatarDataBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// ─── Busca de dados ───────────────────────────────────────────────────────────

async function buscarDados(clinicaId: string, mes: string): Promise<Record<DentistaKey, LinhaExport[]>> {
  const [ano, mesNum] = mes.split('-').map(Number)
  const inicioMes = `${mes}-01`
  const fimMes = new Date(ano, mesNum, 0).toISOString().split('T')[0]

  // CORREÇÃO: antes buscávamos todos os lançamentos e passávamos os IDs num
  // .in() sobre parcelas — URL de 28 KB que o PostgREST descarta silenciosamente.
  // Agora: parcelas primeiro por clinica_id, lançamentos só dos IDs necessários.

  // 1. Todas as parcelas de receita (sem filtro de data ainda — precisamos de
  //    todas para calcular o saldo total pago de cada lançamento)
  const { data: todasParcelasRaw } = await supabase
    .from('financeiro_parcelas')
    .select('id, lancamento_id, valor, valor_pago, status, data_pagamento, numero')
    .eq('clinica_id', clinicaId)

  const todasParcelas = (todasParcelasRaw ?? []) as Array<{
    id: string
    lancamento_id: string
    valor: number
    valor_pago: number | null
    status: string
    data_pagamento: string | null
    numero: number
  }>

  if (!todasParcelas.length) {
    return { rosieli: [], eduardo: [], pamela: [] }
  }

  // 2. Buscar lançamentos de receita apenas dos IDs que aparecem nas parcelas
  const lancIdsUnicos = [...new Set(todasParcelas.map(p => p.lancamento_id))]

  const { data: lancsRaw } = await supabase
    .from('financeiro_lancamentos')
    .select('id, descricao, valor_total, paciente_id, tipo')
    .in('id', lancIdsUnicos)
    .eq('tipo', 'receita')

  const lancs = (lancsRaw ?? []) as Array<{
    id: string
    descricao: string
    valor_total: number
    paciente_id: string | null
    tipo: string
  }>

  if (!lancs.length) return { rosieli: [], eduardo: [], pamela: [] }

  const lancIds = new Set(lancs.map(l => l.id))

  // Filtrar parcelas para apenas as de receita
  const parcelas = todasParcelas.filter(p => lancIds.has(p.lancamento_id))

  // Parcelas pagas NO mês selecionado
  const parcelasMes = parcelas.filter(p =>
    (p.status === 'pago' || p.status === 'pago_parcial') &&
    p.data_pagamento &&
    p.data_pagamento >= inicioMes &&
    p.data_pagamento <= fimMes
  )

  // Índice: lancamento_id → parcelas pagas no mês
  const pagMesMap: Record<string, typeof parcelasMes> = {}
  for (const p of parcelasMes) {
    if (!pagMesMap[p.lancamento_id]) pagMesMap[p.lancamento_id] = []
    pagMesMap[p.lancamento_id].push(p)
  }

  // Total pago de todos os tempos por lançamento (para VALOR PENDENTE)
  const totalPagoMap: Record<string, number> = {}
  for (const p of parcelas) {
    if (p.status === 'pago' || p.status === 'pago_parcial') {
      totalPagoMap[p.lancamento_id] = (totalPagoMap[p.lancamento_id] ?? 0) + (p.valor_pago ?? 0)
    }
  }

  // 3. Nomes dos pacientes
  const pacIds = [...new Set(lancs.map(l => l.paciente_id).filter(Boolean))] as string[]
  const pacMap: Record<string, string> = {}
  if (pacIds.length > 0) {
    const { data: pacs } = await supabase
      .from('pacientes')
      .select('id, nome')
      .in('id', pacIds)
    for (const p of (pacs ?? []) as { id: string; nome: string }[]) {
      pacMap[p.id] = p.nome
    }
  }

  // 4. Montar linhas separadas por dentista
  const grupos: Record<DentistaKey, LinhaExport[]> = { rosieli: [], eduardo: [], pamela: [] }

  for (const lanc of lancs) {
    const dentista = extrairDentista(lanc.descricao)
    const tratamento = limparDescricao(lanc.descricao)
    const paciente = lanc.paciente_id ? (pacMap[lanc.paciente_id] ?? '—') : '—'

    const pagsDoMes = pagMesMap[lanc.id] ?? []
    const valorPagoMes = pagsDoMes.reduce((s, p) => s + (p.valor_pago ?? 0), 0)

    // Data do pagamento mais recente do mês
    const dataPagto = pagsDoMes
      .map(p => p.data_pagamento!)
      .sort()
      .reverse()[0]

    const totalPagoSempre = totalPagoMap[lanc.id] ?? 0
    const valorPendente = Math.max(0, lanc.valor_total - totalPagoSempre)

    grupos[dentista].push({
      paciente,
      tratamento: tratamento || 'Pagamento Avulso',
      valorTotal: lanc.valor_total,
      tipoPagto: '',       // sem coluna no banco ainda — ver item #4 das melhorias
      valorPago: valorPagoMes,
      dataPagto: dataPagto ? formatarDataBR(dataPagto) : '',
      valorPendente,
    })
  }

  // Ordenar cada grupo: quem pagou no mês primeiro, depois por nome
  const ordenar = (a: LinhaExport, b: LinhaExport) => {
    if (a.valorPago > 0 && b.valorPago === 0) return -1
    if (a.valorPago === 0 && b.valorPago > 0) return 1
    return a.paciente.localeCompare(b.paciente, 'pt-BR')
  }

  grupos.rosieli.sort(ordenar)
  grupos.eduardo.sort(ordenar)
  grupos.pamela.sort(ordenar)

  return grupos
}

// ─── Construção de uma aba ────────────────────────────────────────────────────

function construirAba(
  ws: XLSX.WorkSheet,
  titulo: string,
  linhas: LinhaExport[],
) {
  const totalLinhas = linhas.length
  const primeiraLinhaDados = 3

  XLSX.utils.sheet_add_aoa(ws, [[titulo]], { origin: 'A1' })
  XLSX.utils.sheet_add_aoa(ws, [CABECALHO], { origin: 'A2' })

  if (totalLinhas > 0) {
    const dadosAOA = linhas.map(l => [
      l.paciente,
      l.tratamento,
      l.valorTotal,
      l.tipoPagto,
      l.valorPago || null,
      l.dataPagto || null,
      l.valorPendente,
    ])
    XLSX.utils.sheet_add_aoa(ws, dadosAOA, { origin: `A${primeiraLinhaDados}` })
  }

  const ultimaLinhaDados = primeiraLinhaDados + totalLinhas - 1
  const linhaTotais = ultimaLinhaDados + 2

  const linhaTotal: (string | number | null)[] = [
    'TOTAL',
    null,
    { t: 'n', f: `SUM(C${primeiraLinhaDados}:C${ultimaLinhaDados})` } as unknown as number,
    null,
    { t: 'n', f: `SUM(E${primeiraLinhaDados}:E${ultimaLinhaDados})` } as unknown as number,
    null,
    { t: 'n', f: `SUM(G${primeiraLinhaDados}:G${ultimaLinhaDados})` } as unknown as number,
  ]
  XLSX.utils.sheet_add_aoa(ws, [linhaTotal], { origin: `A${linhaTotais}` })

  ws['!cols'] = [
    { wch: 28 },
    { wch: 30 },
    { wch: 22 },
    { wch: 20 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
  ]

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: linhaTotais, c: 6 },
  })
}

// ─── Função principal exportada ───────────────────────────────────────────────

export async function exportarMensal(clinicaId: string, mes: string): Promise<void> {
  const [ano, mesNum] = mes.split('-').map(Number)
  const nomeMes = MESES_PT[mesNum - 1]
  const tituloMes = `${nomeMes} ${ano}`

  const grupos = await buscarDados(clinicaId, mes)

  const wb = XLSX.utils.book_new()

  const abasDentistas: Array<{ key: DentistaKey; nomeLong: string; nomeAba: string }> = [
    { key: 'rosieli', nomeLong: 'Drª Rosieli Hoffmann',   nomeAba: 'Drª Rosieli'  },
    { key: 'eduardo', nomeLong: 'Drº Eduardo Corteletti', nomeAba: 'Dr. Eduardo'  },
    { key: 'pamela',  nomeLong: 'Drª Pamela Bolsoni',     nomeAba: 'Drª Pamela'   },
  ]

  for (const { key, nomeLong, nomeAba } of abasDentistas) {
    const ws = XLSX.utils.aoa_to_sheet([])
    construirAba(
      ws,
      `Acompanhamento Pacientes ${tituloMes} — ${nomeLong}`,
      grupos[key],
    )
    XLSX.utils.book_append_sheet(wb, ws, nomeAba)
  }

  XLSX.writeFile(wb, `pacientes_${mes}_hoffmann.xlsx`)
}