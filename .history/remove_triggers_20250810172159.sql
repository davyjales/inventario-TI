-- Comandos para remover os triggers que manipulam o histórico na tabela equipamentos

DROP TRIGGER IF EXISTS after_equipment_insert;
DROP TRIGGER IF EXISTS after_equipment_delete;
