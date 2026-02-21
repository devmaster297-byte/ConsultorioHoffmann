-- ============================================================
-- DenteSoft — Migration 001: Schema Inicial com RLS
-- ============================================================

-- ============================================================
-- TABELA: clinicas
-- ============================================================
CREATE TABLE IF NOT EXISTS clinicas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  cnpj_cpf   text,
  telefone   text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clinicas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABELA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id         uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  clinica_id uuid REFERENCES clinicas ON DELETE CASCADE NOT NULL,
  nome       text NOT NULL,
  perfil     text CHECK (perfil IN ('dentista', 'secretaria', 'admin')) NOT NULL,
  ativo      boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_clinica_isolation" ON usuarios
  USING (id = auth.uid() OR clinica_id = (
    SELECT clinica_id FROM usuarios WHERE id = auth.uid()
  ));

-- ============================================================
-- TABELA: pacientes
-- ============================================================
CREATE TABLE IF NOT EXISTS pacientes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id       uuid REFERENCES clinicas ON DELETE CASCADE NOT NULL,
  nome             text NOT NULL,
  data_nascimento  date,
  cpf              text,
  telefone         text,
  email            text,
  foto_url         text,
  observacoes      text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pacientes_clinica_isolation" ON pacientes
  USING (clinica_id = (
    SELECT clinica_id FROM usuarios WHERE id = auth.uid()
  ));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pacientes_updated_at
  BEFORE UPDATE ON pacientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABELA: procedimentos
-- ============================================================
CREATE TABLE IF NOT EXISTS procedimentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id    uuid REFERENCES clinicas ON DELETE CASCADE NOT NULL,
  nome          text NOT NULL,
  valor_padrao  numeric(10,2),
  ativo         boolean DEFAULT true
);

ALTER TABLE procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "procedimentos_clinica_isolation" ON procedimentos
  USING (clinica_id = (
    SELECT clinica_id FROM usuarios WHERE id = auth.uid()
  ));

-- ============================================================
-- TABELA: atendimentos
-- ============================================================
CREATE TABLE IF NOT EXISTS atendimentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id        uuid REFERENCES clinicas ON DELETE CASCADE NOT NULL,
  paciente_id       uuid REFERENCES pacientes ON DELETE CASCADE NOT NULL,
  dentista_id       uuid REFERENCES usuarios,
  data_atendimento  date NOT NULL,
  procedimento_id   uuid REFERENCES procedimentos,
  descricao         text,
  valor_total       numeric(10,2),
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atendimentos_clinica_isolation" ON atendimentos
  USING (clinica_id = (
    SELECT clinica_id FROM usuarios WHERE id = auth.uid()
  ));

-- ============================================================
-- TABELA: radiografias
-- ============================================================
CREATE TABLE IF NOT EXISTS radiografias (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id       uuid REFERENCES clinicas ON DELETE CASCADE NOT NULL,
  paciente_id      uuid REFERENCES pacientes ON DELETE CASCADE NOT NULL,
  atendimento_id   uuid REFERENCES atendimentos ON DELETE SET NULL,
  storage_path     text NOT NULL,
  thumbnail_path   text,
  anotacao         text,
  data_exame       date,
  tipo             text CHECK (tipo IN ('periapical', 'panoramico', 'outro')),
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE radiografias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "radiografias_clinica_isolation" ON radiografias
  USING (clinica_id = (
    SELECT clinica_id FROM usuarios WHERE id = auth.uid()
  ));

-- ============================================================
-- TABELA: financeiro_lancamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id     uuid REFERENCES clinicas ON DELETE CASCADE NOT NULL,
  atendimento_id uuid REFERENCES atendimentos ON DELETE SET NULL,
  paciente_id    uuid REFERENCES pacientes ON DELETE SET NULL,
  tipo           text CHECK (tipo IN ('receita', 'despesa')) NOT NULL,
  descricao      text NOT NULL,
  valor_total    numeric(10,2) NOT NULL,
  num_parcelas   integer DEFAULT 1,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lancamentos_clinica_isolation" ON financeiro_lancamentos
  USING (clinica_id = (
    SELECT clinica_id FROM usuarios WHERE id = auth.uid()
  ));

-- ============================================================
-- TABELA: financeiro_parcelas
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_parcelas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id    uuid REFERENCES financeiro_lancamentos ON DELETE CASCADE NOT NULL,
  clinica_id       uuid REFERENCES clinicas ON DELETE CASCADE NOT NULL,
  numero           integer NOT NULL,
  valor            numeric(10,2) NOT NULL,
  data_vencimento  date NOT NULL,
  data_pagamento   date,
  valor_pago       numeric(10,2),
  status           text CHECK (status IN ('pendente','pago','pago_parcial','vencido')) DEFAULT 'pendente'
);

ALTER TABLE financeiro_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parcelas_clinica_isolation" ON financeiro_parcelas
  USING (clinica_id = (
    SELECT clinica_id FROM usuarios WHERE id = auth.uid()
  ));

-- ============================================================
-- STORAGE: bucket radiografias (executar no dashboard Supabase)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('radiografias', 'radiografias', false);
-- 
-- CREATE POLICY "radiografias_storage_isolation" ON storage.objects
--   FOR ALL USING (
--     bucket_id = 'radiografias' AND
--     (storage.foldername(name))[1] = (
--       SELECT clinica_id::text FROM usuarios WHERE id = auth.uid()
--     )
--   );

-- ============================================================
-- pg_cron: atualizar parcelas vencidas (requer extensão ativa)
-- ============================================================
-- SELECT cron.schedule(
--   'atualizar-parcelas-vencidas',
--   '5 0 * * *',
--   $$
--     UPDATE financeiro_parcelas
--     SET status = 'vencido'
--     WHERE status = 'pendente'
--       AND data_vencimento < CURRENT_DATE
--       AND data_pagamento IS NULL;
--   $$
-- );

-- ============================================================
-- DADOS INICIAIS: procedimentos padrão
-- ============================================================
-- (inserir após criar a clínica, substituindo o clinica_id)
-- INSERT INTO procedimentos (clinica_id, nome, valor_padrao) VALUES
--   ('SEU_CLINICA_ID', 'Consulta', 150.00),
--   ('SEU_CLINICA_ID', 'Limpeza', 200.00),
--   ('SEU_CLINICA_ID', 'Extração', 300.00),
--   ('SEU_CLINICA_ID', 'Restauração', 250.00),
--   ('SEU_CLINICA_ID', 'Canal', 800.00),
--   ('SEU_CLINICA_ID', 'Clareamento', 600.00),
--   ('SEU_CLINICA_ID', 'Raio-X', 80.00);
