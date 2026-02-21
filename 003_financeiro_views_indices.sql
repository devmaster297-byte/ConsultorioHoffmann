-- ============================================================
-- DenteSoft — Migration 003: Financeiro (Views e pg_cron)
-- ============================================================

-- ============================================================
-- 1. View: status financeiro de pacientes (para badges)
--    Utilizada como alternativa mais performática a queries ad-hoc
-- ============================================================
CREATE OR REPLACE VIEW vw_paciente_status_financeiro AS
SELECT
  p.id AS paciente_id,
  p.clinica_id,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM financeiro_parcelas fp
      JOIN financeiro_lancamentos fl ON fl.id = fp.lancamento_id
      WHERE fl.paciente_id = p.id
        AND fp.status = 'vencido'
    ) THEN 'vencido'
    WHEN EXISTS (
      SELECT 1
      FROM financeiro_parcelas fp
      JOIN financeiro_lancamentos fl ON fl.id = fp.lancamento_id
      WHERE fl.paciente_id = p.id
        AND fp.status IN ('pendente', 'pago_parcial')
    ) THEN 'pendente'
    ELSE 'em_dia'
  END AS status_financeiro
FROM pacientes p;

-- ============================================================
-- 2. View: métricas mensais por clínica
-- ============================================================
CREATE OR REPLACE VIEW vw_metricas_mensais AS
SELECT
  fp.clinica_id,
  TO_CHAR(fp.data_vencimento, 'YYYY-MM') AS mes,
  fl.tipo,
  SUM(
    CASE fp.status
      WHEN 'pago'         THEN COALESCE(fp.valor_pago, fp.valor)
      WHEN 'pago_parcial' THEN COALESCE(fp.valor_pago, 0)
      ELSE 0
    END
  ) AS total_recebido,
  SUM(
    CASE fp.status
      WHEN 'pendente'     THEN fp.valor
      WHEN 'pago_parcial' THEN fp.valor - COALESCE(fp.valor_pago, 0)
      WHEN 'vencido'      THEN fp.valor - COALESCE(fp.valor_pago, 0)
      ELSE 0
    END
  ) AS total_pendente
FROM financeiro_parcelas fp
JOIN financeiro_lancamentos fl ON fl.id = fp.lancamento_id
GROUP BY fp.clinica_id, mes, fl.tipo;

-- ============================================================
-- 3. pg_cron: atualizar parcelas vencidas automaticamente
--    Roda toda madrugada às 00:05
--    Requer extensão pg_cron habilitada no Supabase
--    (Ativar em Database > Extensions > pg_cron)
-- ============================================================
SELECT cron.schedule(
  'atualizar-parcelas-vencidas',
  '5 0 * * *',
  $$
    UPDATE financeiro_parcelas
    SET status = 'vencido'
    WHERE status = 'pendente'
      AND data_vencimento < CURRENT_DATE
      AND data_pagamento IS NULL;
  $$
);

-- ============================================================
-- 4. Índices para performance
-- ============================================================

-- Parcelas por clínica + status (query mais comum)
CREATE INDEX IF NOT EXISTS idx_parcelas_clinica_status
  ON financeiro_parcelas (clinica_id, status);

-- Parcelas por data de vencimento (inadimplentes, vencimentos futuros)
CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento
  ON financeiro_parcelas (data_vencimento, status)
  WHERE status IN ('pendente', 'vencido');

-- Lançamentos por paciente
CREATE INDEX IF NOT EXISTS idx_lancamentos_paciente
  ON financeiro_lancamentos (clinica_id, paciente_id);

-- Atendimentos por paciente
CREATE INDEX IF NOT EXISTS idx_atendimentos_paciente
  ON atendimentos (clinica_id, paciente_id, data_atendimento DESC);

-- Radiografias por paciente
CREATE INDEX IF NOT EXISTS idx_radiografias_paciente
  ON radiografias (clinica_id, paciente_id, created_at DESC);

-- Pacientes por nome (busca ilike)
CREATE INDEX IF NOT EXISTS idx_pacientes_nome
  ON pacientes USING gin (nome gin_trgm_ops);

-- (requer extensão pg_trgm — ativar em Database > Extensions)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
