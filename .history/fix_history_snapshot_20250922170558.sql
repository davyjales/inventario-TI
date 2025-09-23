-- Adicionar campo snapshot na tabela equipment_history
ALTER TABLE equipment_history ADD COLUMN snapshot TEXT;

-- Atualizar registros existentes que têm snapshot no changed_fields
-- para mover o snapshot para o campo correto
UPDATE equipment_history
SET snapshot = changed_fields
WHERE action IN ('create', 'consulta')
   AND changed_fields IS NOT NULL
   AND changed_fields != '';

-- Para registros de update, manter apenas as mudanças no changed_fields
-- e buscar o estado completo do equipamento para o snapshot
UPDATE equipment_history
SET snapshot = (
    SELECT JSON_OBJECT(
        'id', e.id,
        'categoria_id', e.categoria_id,
        'nome', e.nome,
        'dono', e.dono,
        'setor', e.setor,
        'descricao', e.descricao,
        'termo', e.termo,
        'qrCode', e.qrCode,
        'hostname', e.hostname,
        'status_id', e.status_id,
        'cargo', e.cargo,
        'additionalFields', COALESCE((
            SELECT JSON_GROUP_OBJECT(cca.nome_exibicao, eca.valor)
            FROM equipamento_campos_adicionais eca
            LEFT JOIN categoria_campos_adicionais cca ON eca.campo_id = cca.id
            WHERE eca.equipamento_id = e.id
        ), JSON_OBJECT())
    )
    FROM equipamentos e
    WHERE e.id = equipment_history.equipment_id
)
WHERE action = 'update'
  AND snapshot IS NULL;
