// src/lib/supabase/types.ts
// Regenerado a partir do schema real via Supabase (supabase gen types typescript).
// Substitui a versão manual anterior, que estava desatualizada:
// faltavam as tabelas `orcamentos` e `orcamento_itens`, a coluna `orcamento_id`
// em `financeiro_lancamentos`, e a coluna `forma_pagamento` em `financeiro_parcelas`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      atendimentos: {
        Row: {
          clinica_id: string
          created_at: string | null
          data_atendimento: string
          dentista_id: string | null
          descricao: string | null
          id: string
          paciente_id: string
          procedimento_id: string | null
          procedimento_nome: string | null
          valor_total: number | null
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          data_atendimento: string
          dentista_id?: string | null
          descricao?: string | null
          id?: string
          paciente_id: string
          procedimento_id?: string | null
          procedimento_nome?: string | null
          valor_total?: number | null
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          data_atendimento?: string
          dentista_id?: string | null
          descricao?: string | null
          id?: string
          paciente_id?: string
          procedimento_id?: string | null
          procedimento_nome?: string | null
          valor_total?: number | null
        }
        Relationships: [
          { foreignKeyName: "atendimentos_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
          { foreignKeyName: "atendimentos_dentista_id_fkey"; columns: ["dentista_id"]; isOneToOne: false; referencedRelation: "usuarios"; referencedColumns: ["id"] },
          { foreignKeyName: "atendimentos_paciente_id_fkey"; columns: ["paciente_id"]; isOneToOne: false; referencedRelation: "pacientes"; referencedColumns: ["id"] },
          { foreignKeyName: "atendimentos_paciente_id_fkey"; columns: ["paciente_id"]; isOneToOne: false; referencedRelation: "vw_paciente_status_financeiro"; referencedColumns: ["paciente_id"] },
          { foreignKeyName: "atendimentos_procedimento_id_fkey"; columns: ["procedimento_id"]; isOneToOne: false; referencedRelation: "procedimentos"; referencedColumns: ["id"] },
          { foreignKeyName: "fk_atendimentos_dentista"; columns: ["dentista_id"]; isOneToOne: false; referencedRelation: "usuarios"; referencedColumns: ["id"] },
        ]
      }
      clinicas: {
        Row: {
          cnpj_cpf: string | null
          created_at: string | null
          evolution_apikey: string | null
          evolution_instance: string | null
          evolution_url: string | null
          id: string
          nome: string
          percentual_patricia: number
          percentual_rosieli: number
          telefone: string | null
        }
        Insert: {
          cnpj_cpf?: string | null
          created_at?: string | null
          evolution_apikey?: string | null
          evolution_instance?: string | null
          evolution_url?: string | null
          id?: string
          nome: string
          percentual_patricia?: number
          percentual_rosieli?: number
          telefone?: string | null
        }
        Update: {
          cnpj_cpf?: string | null
          created_at?: string | null
          evolution_apikey?: string | null
          evolution_instance?: string | null
          evolution_url?: string | null
          id?: string
          nome?: string
          percentual_patricia?: number
          percentual_rosieli?: number
          telefone?: string | null
        }
        Relationships: []
      }
      financeiro_lancamentos: {
        Row: {
          atendimento_id: string | null
          clinica_id: string
          created_at: string | null
          descricao: string
          id: string
          num_parcelas: number | null
          orcamento_id: string | null
          paciente_id: string | null
          tipo: string
          valor_total: number
        }
        Insert: {
          atendimento_id?: string | null
          clinica_id: string
          created_at?: string | null
          descricao: string
          id?: string
          num_parcelas?: number | null
          orcamento_id?: string | null
          paciente_id?: string | null
          tipo: string
          valor_total: number
        }
        Update: {
          atendimento_id?: string | null
          clinica_id?: string
          created_at?: string | null
          descricao?: string
          id?: string
          num_parcelas?: number | null
          orcamento_id?: string | null
          paciente_id?: string | null
          tipo?: string
          valor_total?: number
        }
        Relationships: [
          { foreignKeyName: "financeiro_lancamentos_atendimento_id_fkey"; columns: ["atendimento_id"]; isOneToOne: false; referencedRelation: "atendimentos"; referencedColumns: ["id"] },
          { foreignKeyName: "financeiro_lancamentos_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
          { foreignKeyName: "financeiro_lancamentos_orcamento_id_fkey"; columns: ["orcamento_id"]; isOneToOne: false; referencedRelation: "orcamentos"; referencedColumns: ["id"] },
          { foreignKeyName: "financeiro_lancamentos_paciente_id_fkey"; columns: ["paciente_id"]; isOneToOne: false; referencedRelation: "pacientes"; referencedColumns: ["id"] },
          { foreignKeyName: "financeiro_lancamentos_paciente_id_fkey"; columns: ["paciente_id"]; isOneToOne: false; referencedRelation: "vw_paciente_status_financeiro"; referencedColumns: ["paciente_id"] },
        ]
      }
      financeiro_parcelas: {
        Row: {
          clinica_id: string
          data_pagamento: string | null
          data_vencimento: string
          forma_pagamento: string | null
          id: string
          lancamento_id: string
          numero: number
          status: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          clinica_id: string
          data_pagamento?: string | null
          data_vencimento: string
          forma_pagamento?: string | null
          id?: string
          lancamento_id: string
          numero: number
          status?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          clinica_id?: string
          data_pagamento?: string | null
          data_vencimento?: string
          forma_pagamento?: string | null
          id?: string
          lancamento_id?: string
          numero?: number
          status?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          { foreignKeyName: "financeiro_parcelas_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
          { foreignKeyName: "financeiro_parcelas_lancamento_id_fkey"; columns: ["lancamento_id"]; isOneToOne: false; referencedRelation: "financeiro_lancamentos"; referencedColumns: ["id"] },
        ]
      }
      mensagens_whatsapp: {
        Row: {
          clinica_id: string
          created_at: string
          enviada_por: string
          erro_msg: string | null
          id: string
          mensagem: string
          paciente_id: string | null
          paciente_nome: string
          status: string
          telefone: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          enviada_por: string
          erro_msg?: string | null
          id?: string
          mensagem: string
          paciente_id?: string | null
          paciente_nome: string
          status?: string
          telefone: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          enviada_por?: string
          erro_msg?: string | null
          id?: string
          mensagem?: string
          paciente_id?: string | null
          paciente_nome?: string
          status?: string
          telefone?: string
        }
        Relationships: [
          { foreignKeyName: "mensagens_whatsapp_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
          { foreignKeyName: "mensagens_whatsapp_paciente_id_fkey"; columns: ["paciente_id"]; isOneToOne: false; referencedRelation: "pacientes"; referencedColumns: ["id"] },
          { foreignKeyName: "mensagens_whatsapp_paciente_id_fkey"; columns: ["paciente_id"]; isOneToOne: false; referencedRelation: "vw_paciente_status_financeiro"; referencedColumns: ["paciente_id"] },
        ]
      }
      orcamento_itens: {
        Row: {
          descricao: string | null
          id: string
          orcamento_id: string
          procedimento_id: string | null
          procedimento_nome: string
          valor: number
        }
        Insert: {
          descricao?: string | null
          id?: string
          orcamento_id: string
          procedimento_id?: string | null
          procedimento_nome: string
          valor?: number
        }
        Update: {
          descricao?: string | null
          id?: string
          orcamento_id?: string
          procedimento_id?: string | null
          procedimento_nome?: string
          valor?: number
        }
        Relationships: [
          { foreignKeyName: "orcamento_itens_orcamento_id_fkey"; columns: ["orcamento_id"]; isOneToOne: false; referencedRelation: "orcamentos"; referencedColumns: ["id"] },
          { foreignKeyName: "orcamento_itens_procedimento_id_fkey"; columns: ["procedimento_id"]; isOneToOne: false; referencedRelation: "procedimentos"; referencedColumns: ["id"] },
        ]
      }
      orcamentos: {
        Row: {
          aprovado_em: string | null
          clinica_id: string
          created_at: string
          id: string
          observacoes: string | null
          paciente_id: string
          status: string
        }
        Insert: {
          aprovado_em?: string | null
          clinica_id: string
          created_at?: string
          id?: string
          observacoes?: string | null
          paciente_id: string
          status?: string
        }
        Update: {
          aprovado_em?: string | null
          clinica_id?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string
          status?: string
        }
        Relationships: [
          { foreignKeyName: "orcamentos_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
          { foreignKeyName: "orcamentos_paciente_id_fkey"; columns: ["paciente_id"]; isOneToOne: false; referencedRelation: "pacientes"; referencedColumns: ["id"] },
          { foreignKeyName: "orcamentos_paciente_id_fkey"; columns: ["paciente_id"]; isOneToOne: false; referencedRelation: "vw_paciente_status_financeiro"; referencedColumns: ["paciente_id"] },
        ]
      }
      pacientes: {
        Row: {
          alergias: string | null
          clinica_id: string
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          endereco: string | null
          foto_url: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          alergias?: string | null
          clinica_id: string
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          alergias?: string | null
          clinica_id?: string
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "pacientes_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
        ]
      }
      procedimentos: {
        Row: {
          ativo: boolean | null
          clinica_id: string
          id: string
          nome: string
          valor_padrao: number | null
        }
        Insert: {
          ativo?: boolean | null
          clinica_id: string
          id?: string
          nome: string
          valor_padrao?: number | null
        }
        Update: {
          ativo?: boolean | null
          clinica_id?: string
          id?: string
          nome?: string
          valor_padrao?: number | null
        }
        Relationships: [
          { foreignKeyName: "procedimentos_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
        ]
      }
      radiografias: {
        Row: {
          anotacao: string | null
          arquivo_url: string | null
          atendimento_id: string | null
          clinica_id: string
          created_at: string | null
          data_exame: string | null
          id: string
          paciente_id: string
          storage_path: string
          thumbnail_path: string | null
          tipo: string | null
        }
        Insert: {
          anotacao?: string | null
          arquivo_url?: string | null
          atendimento_id?: string | null
          clinica_id: string
          created_at?: string | null
          data_exame?: string | null
          id?: string
          paciente_id: string
          storage_path: string
          thumbnail_path?: string | null
          tipo?: string | null
        }
        Update: {
          anotacao?: string | null
          arquivo_url?: string | null
          atendimento_id?: string | null
          clinica_id?: string
          created_at?: string | null
          data_exame?: string | null
          id?: string
          paciente_id?: string
          storage_path?: string
          thumbnail_path?: string | null
          tipo?: string | null
        }
        Relationships: [
          { foreignKeyName: "radiografias_atendimento_id_fkey"; columns: ["atendimento_id"]; isOneToOne: false; referencedRelation: "atendimentos"; referencedColumns: ["id"] },
          { foreignKeyName: "radiografias_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
          { foreignKeyName: "radiografias_paciente_id_fkey"; columns: ["paciente_id"]; isOneToOne: false; referencedRelation: "pacientes"; referencedColumns: ["id"] },
          { foreignKeyName: "radiografias_paciente_id_fkey"; columns: ["paciente_id"]; isOneToOne: false; referencedRelation: "vw_paciente_status_financeiro"; referencedColumns: ["paciente_id"] },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean | null
          clinica_id: string
          created_at: string | null
          id: string
          nome: string
          perfil: string
        }
        Insert: {
          ativo?: boolean | null
          clinica_id: string
          created_at?: string | null
          id: string
          nome: string
          perfil: string
        }
        Update: {
          ativo?: boolean | null
          clinica_id?: string
          created_at?: string | null
          id?: string
          nome?: string
          perfil?: string
        }
        Relationships: [
          { foreignKeyName: "usuarios_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: {
      vw_metricas_mensais: {
        Row: {
          clinica_id: string | null
          mes: string | null
          tipo: string | null
          total_pendente: number | null
          total_recebido: number | null
        }
        Relationships: [
          { foreignKeyName: "financeiro_parcelas_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
        ]
      }
      vw_paciente_status_financeiro: {
        Row: {
          clinica_id: string | null
          paciente_id: string | null
          status_financeiro: string | null
        }
        Insert: {
          clinica_id?: string | null
          paciente_id?: string | null
          status_financeiro?: never
        }
        Update: {
          clinica_id?: string | null
          paciente_id?: string | null
          status_financeiro?: never
        }
        Relationships: [
          { foreignKeyName: "pacientes_clinica_id_fkey"; columns: ["clinica_id"]; isOneToOne: false; referencedRelation: "clinicas"; referencedColumns: ["id"] },
        ]
      }
    }
    Functions: {
      minha_clinica_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// ─── Tipos de conveniência ─────────────────────────────────────────────────────
export type Clinica = Database['public']['Tables']['clinicas']['Row']
export type Usuario = Database['public']['Tables']['usuarios']['Row']
export type Paciente = Database['public']['Tables']['pacientes']['Row']
export type Procedimento = Database['public']['Tables']['procedimentos']['Row']
export type Atendimento = Database['public']['Tables']['atendimentos']['Row']
export type Radiografia = Database['public']['Tables']['radiografias']['Row']
export type FinanceiroLancamento = Database['public']['Tables']['financeiro_lancamentos']['Row']
export type FinanceiroParcela = Database['public']['Tables']['financeiro_parcelas']['Row']
export type Orcamento = Database['public']['Tables']['orcamentos']['Row']
export type OrcamentoItem = Database['public']['Tables']['orcamento_itens']['Row']
export type MensagemWhatsapp = Database['public']['Tables']['mensagens_whatsapp']['Row']

// Colunas `status` são `text` no Postgres (não enum), então o gerador tipa como
// `string`. Estes literais são só para uso opcional em código novo — não mudam
// o schema real, então não travam nada que já existe.
export type StatusParcela = 'pendente' | 'pago' | 'pago_parcial' | 'vencido' | 'cancelado'
export type StatusOrcamento = 'pendente' | 'aprovado' | 'recusado'

// ─── Tipos compostos para queries com join ─────────────────────────────────────
export type PacienteComStatus = Paciente & {
  status_financeiro: 'em_dia' | 'pendente' | 'vencido'
}

export type AtendimentoComDetalhes = Atendimento & {
  procedimento: Procedimento | null
  dentista: { nome: string } | null
  radiografias: Pick<Radiografia, 'id' | 'storage_path' | 'thumbnail_path'>[]
}
