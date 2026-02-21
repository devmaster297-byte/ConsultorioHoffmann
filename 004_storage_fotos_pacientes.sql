-- ============================================================
-- DenteSoft — Migration 004: Storage para Fotos de Pacientes
-- ============================================================

-- Criar bucket privado para fotos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-pacientes',
  'fotos-pacientes',
  false,           -- NUNCA público (LGPD)
  5242880,         -- 5MB por foto
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Policy de leitura: apenas da própria clínica
CREATE POLICY "fotos_storage_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'fotos-pacientes'
    AND (storage.foldername(name))[1] = (
      SELECT clinica_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  );

-- Policy de inserção
CREATE POLICY "fotos_storage_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'fotos-pacientes'
    AND (storage.foldername(name))[1] = (
      SELECT clinica_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  );

-- Policy de atualização (upsert)
CREATE POLICY "fotos_storage_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'fotos-pacientes'
    AND (storage.foldername(name))[1] = (
      SELECT clinica_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  );

-- Policy de deleção
CREATE POLICY "fotos_storage_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'fotos-pacientes'
    AND (storage.foldername(name))[1] = (
      SELECT clinica_id::text FROM public.usuarios WHERE id = auth.uid()
    )
  );

-- ============================================================
-- Estrutura do path: {clinica_id}/fotos/{paciente_id}.jpg
-- O FotoUploader usa upsert: true, então a foto é sobrescrita
-- a cada troca, sem acumular arquivos órfãos.
-- ============================================================
