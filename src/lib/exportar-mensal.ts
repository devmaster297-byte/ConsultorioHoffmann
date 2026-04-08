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

// Mapa de chave interna → forma legível
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

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface LinhaExport {
  paciente:     string
  tratamento:   string
  valorTotal:   number
  tipoPagto:    string
  valorPago:    number
  dataPagto:    string
  valorPendente: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function limparDescricao(descricao: string): string {
  return descricao
    .replace(/\[orc:[a-f0-9-]{36}\]/g, '')  // remove prefixo do orçamento
    .replace(/\[[a-z]+\]/g, '')              // remove prefixo do dentista
    .trim()
}

function extrairDentista(descricao: string): 'rosiele' | 'eduardo' | null {
  const tags = [...descricao.matchAll(/\[([a-z]+)\]/g)]
  for (const m of tags) {
    if (m[1] === 'rosiele' || m[1] === 'eduardo') return m[1]
  }
  return null
}

function formatarDataBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// ─── Busca de dados ───────────────────────────────────────────────────────────

async function buscarDados(clinicaId: string, mes: string): Promise<{
  rosiele: LinhaExport[]
  eduardo: LinhaExport[]
}> {
  const [ano, mesNum] = mes.split('-').map(Number)
  const inicioMes = `${mes}-01`
  const fimMes = new Date(ano, mesNum, 0).toISOString().split('T')[0]

  // 1. Todos os lançamentos de receita da clínica
  const { data: lancsRaw } = await supabase
    .from('financeiro_lancamentos')
    .select('id, descricao, valor_total, paciente_id, tipo')
    .eq('clinica_id', clinicaId)
    .eq('tipo', 'receita')

  const lancs = (lancsRaw ?? []) as Array<{
    id: string
    descricao: string
    valor_total: number
    paciente_id: string | null
    tipo: string
  }>

  if (!lancs.length) return { rosiele: [], eduardo: [] }

  const lancIds = lancs.map(l => l.id)

  // 2. Todas as parcelas desses lançamentos
  const { data: parcelasRaw } = await supabase
    .from('financeiro_parcelas')
    .select('id, lancamento_id, valor, valor_pago, status, data_pagamento, numero')
    .in('lancamento_id', lancIds)

  const parcelas = (parcelasRaw ?? []) as Array<{
    id: string
    lancamento_id: string
    valor: number
    valor_pago: number | null
    status: string
    data_pagamento: string | null
    numero: number
  }>

  // Parcelas pagas NO mês selecionado (para VALOR PAGO e Data do Pagamento)
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

  // Total pago de todos os tempos por lancamento (para VALOR PENDENTE)
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

  // 4. Buscar forma de pagamento do mês (da parcela mais recente do mês)
  // A forma fica no observação da parcela ou no lançamento; como não temos coluna
  // específica, usamos o campo genérico da descrição avulsa ou deixamos em branco.
  // Para pagamentos via FinanceiroAba, a forma foi registrada na observacao da parcela.
  // Aqui buscamos nas parcelas o campo 'observacao' se existir, caso contrário deixa vazio.
  // (Campo forma_pagamento não está no schema atual — seria uma evolução futura)

  // 5. Montar linhas por dentista
  const rosiele: LinhaExport[] = []
  const eduardo: LinhaExport[] = []

  for (const lanc of lancs) {
    const dentista = extrairDentista(lanc.descricao)
    const tratamento = limparDescricao(lanc.descricao)
    const paciente = lanc.paciente_id ? (pacMap[lanc.paciente_id] ?? '—') : '—'

    const pagsDoMes = pagMesMap[lanc.id] ?? []
    const valorPagoMes = pagsDoMes.reduce((s, p) => s + (p.valor_pago ?? 0), 0)

    // Data do pagamento mais recente do mês
    const datasDoMes = pagsDoMes
      .map(p => p.data_pagamento!)
      .sort()
      .reverse()
    const dataPagto = datasDoMes[0] ? formatarDataBR(datasDoMes[0]) : ''

    // Forma de pagamento — extraída da descricao avulsa se possível
    // Formato avulso: "[eduardo] Manutenção" — sem forma na descricao
    // Usamos em branco por ora; campo futuro quando adicionarmos coluna
    const tipoPagto = ''

    const totalPagoSempre = totalPagoMap[lanc.id] ?? 0
    const valorPendente = Math.max(0, lanc.valor_total - totalPagoSempre)

    const linha: LinhaExport = {
      paciente,
      tratamento: tratamento || 'Pagamento Avulso',
      valorTotal: lanc.valor_total,
      tipoPagto,
      valorPago: valorPagoMes,
      dataPagto,
      valorPendente,
    }

    // Incluir na seção do dentista — mesmo que não tenha pago esse mês
    // (paciente continua ativo se tem saldo pendente)
    if (dentista === 'eduardo') {
      eduardo.push(linha)
    } else {
      // Rosieli = rosieli explícito OU sem prefixo (padrão)
      rosiele.push(linha)
    }
  }

  // Ordenar: primeiro quem pagou no mês, depois por nome
  const ordenar = (a: LinhaExport, b: LinhaExport) => {
    if (a.valorPago > 0 && b.valorPago === 0) return -1
    if (a.valorPago === 0 && b.valorPago > 0) return 1
    return a.paciente.localeCompare(b.paciente, 'pt-BR')
  }

  rosiele.sort(ordenar)
  eduardo.sort(ordenar)

  return { rosiele, eduardo }
}

// ─── Construção da aba ────────────────────────────────────────────────────────

function construirAba(
  ws: XLSX.WorkSheet,
  titulo: string,
  linhas: LinhaExport[],
  nomeAbreviado: string
) {
  const totalLinhas = linhas.length
  const primeiraLinhaDados = 3   // linha 1 = título, linha 2 = cabeçalho

  // Linha 1: título
  XLSX.utils.sheet_add_aoa(ws, [[titulo]], { origin: 'A1' })

  // Linha 2: cabeçalho
  XLSX.utils.sheet_add_aoa(ws, [CABECALHO], { origin: 'A2' })

  // Linhas de dados
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

  // Linha de totais
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

  // Larguras das colunas
  ws['!cols'] = [
    { wch: 28 }, // A: PACIENTE
    { wch: 30 }, // B: TRATAMENTO
    { wch: 22 }, // C: VALOR TOTAL
    { wch: 20 }, // D: TIPO PAGTO
    { wch: 14 }, // E: VALOR PAGO
    { wch: 20 }, // F: DATA
    { wch: 18 }, // G: PENDENTE
  ]

  // Mesclar título (A1:G1)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]

  // Definir ref total
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

  const { rosiele, eduardo } = await buscarDados(clinicaId, mes)

  const wb = XLSX.utils.book_new()

  // Aba Drª Rosieli
  const wsRosieli = XLSX.utils.aoa_to_sheet([])
  construirAba(
    wsRosieli,
    `Acompanhamento Pacientes ${tituloMes} — Drª Rosieli Hoffmann`,
    rosiele,
    'Rosieli'
  )
  XLSX.utils.book_append_sheet(wb, wsRosieli, 'Drª Rosieli')

  // Aba Dr. Eduardo
  const wsEduardo = XLSX.utils.aoa_to_sheet([])
  construirAba(
    wsEduardo,
    `Acompanhamento Pacientes ${tituloMes} — Drº Eduardo Corteletti`,
    eduardo,
    'Eduardo'
  )
  XLSX.utils.book_append_sheet(wb, wsEduardo, 'Dr. Eduardo')

  // Download
  const nomeArquivo = `pacientes_${mes}_hoffmann.xlsx`
  XLSX.writeFile(wb, nomeArquivo)
}
