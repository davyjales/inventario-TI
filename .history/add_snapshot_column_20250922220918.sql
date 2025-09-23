-- Script para adicionar coluna snapshot na tabela equipment_history
-- Este script adiciona a nova coluna e mantém a compatibilidade com changed_fields

-- Adicionar coluna snapshot
ALTER TABLE equipment_history ADD COLUMN snapshot TEXT;

-- Comentário sobre a mudança
-- A partir de agora:
-- - snapshot: armazena o estado completo do equipamento no momento da ação
-- - changed_fields: usado apenas para mostrar diferenças em updates (botão "Mostrar Alterações")
-- - Fluxo:
--   * Create/Consulta: snapshot = estado completo, changed_fields = {}
--   * Update: snapshot = estado completo antes da mudança, changed_fields = diferenças
--   * Delete: snapshot = último estado, changed_fields = {}
