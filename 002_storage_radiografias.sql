-- ============================================================
-- DenteSoft — Migration 002: Storage para Radiografias
-- ============================================================
-- Execute este script no SQL Editor do Supabase
-- OU configure pelo Dashboard em Storage > New Bucket

-- ============================================================
-- 1. Criar bucket privado
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'radiografias',
  'radiografias',
  false,            -- NUNCA público (LGPD)
  10485760,         -- 10MB por arquivo
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. RLS do Storage: cada clínica acessa só sua pasta
-- Estrutura do path: {clinica_id}/{paciente_id}/{timestamp}.jpg
-- ============================================================

-- Policy de leitura
CREATE POLICY "radiografias_storage_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'radiografias'
    AND (storage.foldername(name))[1] = (
      SELECT clinica_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  );

-- Policy de inserção
CREATE POLICY "radiografias_storage_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'radiografias'
    AND (storage.foldername(name))[1] = (
      SELECT clinica_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  );

-- Policy de deleção
CREATE POLICY "radiografias_storage_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'radiografias'
    AND (storage.foldername(name))[1] = (
      SELECT clinica_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  );

-- ============================================================
-- IMPORTANTE: Signed URLs
-- O código sempre usa createSignedUrl() com expiração de 1h.
-- Nunca usar getPublicUrl() — as imagens NÃO são públicas.
-- ============================================================
--
-- Exemplo de uso no código:
-- const { data } = await supabase.storage
--   .from('radiografias')
--   .createSignedUrl(path, 3600) // 1 hora
