// src/lib/supabase/types.ts
// Gerado manualmente — substituir pelo output de: supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      clinicas: {
        Row: {
          id: string
          nome: string
          cnpj_cpf: string | null
          telefone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          cnpj_cpf?: string | null
          telefone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          cnpj_cpf?: string | null
          telefone?: string | null
          created_at?: string
        }
      }
      usuarios: {
        Row: {
          id: string
          clinica_id: string
          nome: string
          perfil: 'dentista' | 'secretaria' | 'admin'
          ativo: boolean
          created_at: string
        }
        Insert: {
          id: string
          clinica_id: string
          nome: string
          perfil: 'dentista' | 'secretaria' | 'admin'
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clinica_id?: string
          nome?: string
          perfil?: 'dentista' | 'secretaria' | 'admin'
          ativo?: boolean
          created_at?: string
        }
      }
      pacientes: {
        Row: {
          id: string
          clinica_id: string
          nome: string
          data_nascimento: string | null
          cpf: string | null
          telefone: string | null
          email: string | null
          foto_url: string | null
          observacoes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinica_id: string
          nome: string
          data_nascimento?: string | null
          cpf?: string | null
          telefone?: string | null
          email?: string | null
          foto_url?: string | null
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinica_id?: string
          nome?: string
          data_nascimento?: string | null
          cpf?: string | null
          telefone?: string | null
          email?: string | null
          foto_url?: string | null
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      procedimentos: {
        Row: {
          id: string
          clinica_id: string
          nome: string
          valor_padrao: number | null
          ativo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          clinica_id: string
          nome: string
          valor_padrao?: number | null
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clinica_id?: string
          nome?: string
          valor_padrao?: number | null
          ativo?: boolean
          created_at?: string
        }
      }
      atendimentos: {
        Row: {
          id: string
          clinica_id: string
          paciente_id: string
          dentista_id: string | null
          data_atendimento: string
          queixa_principal: string | null
          diagnostico: string | null
          tratamento_realizado: string | null
          observacoes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinica_id: string
          paciente_id: string
          dentista_id?: string | null
          data_atendimento: string
          queixa_principal?: string | null
          diagnostico?: string | null
          tratamento_realizado?: string | null
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinica_id?: string
          paciente_id?: string
          dentista_id?: string | null
          data_atendimento?: string
          queixa_principal?: string | null
          diagnostico?: string | null
          tratamento_realizado?: string | null
          observacoes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      orcamentos: {
        Row: {
          id: string
          clinica_id: string
          paciente_id: string
          status: 'pendente' | 'aprovado' | 'recusado'
          observacoes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinica_id: string
          paciente_id: string
          status?: 'pendente' | 'aprovado' | 'recusado'
          observacoes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinica_id?: string
          paciente_id?: string
          status?: 'pendente' | 'aprovado' | 'recusado'
          observacoes?: string | null
          created_at?: string
        }
      }
      orcamento_itens: {
        Row: {
          id: string
          orcamento_id: string
          procedimento_id: string | null
          procedimento_nome: string
          valor: number
        }
        Insert: {
          id?: string
          orcamento_id: string
          procedimento_id?: string | null
          procedimento_nome: string
          valor: number
        }
        Update: {
          id?: string
          orcamento_id?: string
          procedimento_id?: string | null
          procedimento_nome?: string
          valor?: number
        }
      }
      radiografias: {
        Row: {
          id: string
          clinica_id: string
          paciente_id: string
          atendimento_id: string | null
          storage_path: string          // ✅ FIX: era 'url', campo correto no banco
          thumbnail_path: string | null // ✅ FIX: campo adicionado
          anotacao: string | null
          data_exame: string | null
          tipo: 'periapical' | 'panoramico' | 'outro' | null
          created_at: string
        }
        Insert: {
          id?: string
          clinica_id: string
          paciente_id: string
          atendimento_id?: string | null
          storage_path: string
          thumbnail_path?: string | null
          anotacao?: string | null
          data_exame?: string | null
          tipo?: 'periapical' | 'panoramico' | 'outro' | null
          created_at?: string
        }
        Update: {
          id?: string
          clinica_id?: string
          paciente_id?: string
          atendimento_id?: string | null
          storage_path?: string
          thumbnail_path?: string | null
          anotacao?: string | null
          data_exame?: string | null
          tipo?: 'periapical' | 'panoramico' | 'outro' | null
          created_at?: string
        }
      }
      // ✅ FIX: adicionado orcamento_id em todos os shapes
      financeiro_lancamentos: {
        Row: {
          id: string
          clinica_id: string
          atendimento_id: string | null
          paciente_id: string | null
          orcamento_id: string | null   // ← ADICIONADO
          tipo: 'receita' | 'despesa'
          descricao: string
          valor_total: number
          num_parcelas: number
          created_at: string
        }
        Insert: {
          id?: string
          clinica_id: string
          atendimento_id?: string | null
          paciente_id?: string | null
          orcamento_id?: string | null  // ← ADICIONADO
          tipo: 'receita' | 'despesa'
          descricao: string
          valor_total: number
          num_parcelas?: number
          created_at?: string
        }
        Update: {
          id?: string
          clinica_id?: string
          atendimento_id?: string | null
          paciente_id?: string | null
          orcamento_id?: string | null  // ← ADICIONADO
          tipo?: 'receita' | 'despesa'
          descricao?: string
          valor_total?: number
          num_parcelas?: number
          created_at?: string
        }
      }
      financeiro_parcelas: {
        Row: {
          id: string
          lancamento_id: string
          clinica_id: string
          numero: number
          valor: number
          data_vencimento: string
          data_pagamento: string | null
          valor_pago: number | null
          status: 'pendente' | 'pago' | 'pago_parcial' | 'vencido' | 'cancelado'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lancamento_id: string
          clinica_id: string
          numero: number
          valor: number
          data_vencimento: string
          data_pagamento?: string | null
          valor_pago?: number | null
          status?: 'pendente' | 'pago' | 'pago_parcial' | 'vencido' | 'cancelado'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lancamento_id?: string
          clinica_id?: string
          numero?: number
          valor?: number
          data_vencimento?: string
          data_pagamento?: string | null
          valor_pago?: number | null
          status?: 'pendente' | 'pago' | 'pago_parcial' | 'vencido' | 'cancelado'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Tipos de conveniência
export type Clinica = Database['public']['Tables']['clinicas']['Row']
export type Usuario = Database['public']['Tables']['usuarios']['Row']
export type Paciente = Database['public']['Tables']['pacientes']['Row']
export type Procedimento = Database['public']['Tables']['procedimentos']['Row']
export type Atendimento = Database['public']['Tables']['atendimentos']['Row']
export type Orcamento = Database['public']['Tables']['orcamentos']['Row']
export type OrcamentoItem = Database['public']['Tables']['orcamento_itens']['Row']
export type Radiografia = Database['public']['Tables']['radiografias']['Row']
export type FinanceiroLancamento = Database['public']['Tables']['financeiro_lancamentos']['Row']
export type FinanceiroParcela = Database['public']['Tables']['financeiro_parcelas']['Row']

// Tipos compostos para queries com join
export type PacienteComStatus = Paciente & {
  status_financeiro: 'em_dia' | 'pendente' | 'vencido'
}