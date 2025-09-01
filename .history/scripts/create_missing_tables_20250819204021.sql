-- Script para criar tabelas faltantes no banco inventario_ti
-- Verificar e criar tabela categoria_campos_adicionais se não existir

CREATE TABLE IF NOT EXISTS `categoria_campos_adicionais` (
  `id` int NOT NULL AUTO_INCREMENT,
  `categoria_id` int NOT NULL,
  `nome_exibicao` varchar(255) NOT NULL,
  `tipo` enum('texto','numero','data','lista','booleano') NOT NULL,
  `obrigatorio` tinyint(1) NOT NULL DEFAULT '0',
  `conteudo_unico` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `categoria_id` (`categoria_id`),
  CONSTRAINT `categoria_campos_adicionais_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Criar tabela lista_opcoes se não existir
CREATE TABLE IF NOT EXISTS `lista_opcoes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campo_id` int NOT NULL,
  `value` varchar(255) NOT NULL,
  `label` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `campo_id` (`campo_id`),
  CONSTRAINT `lista_opcoes_ibfk_1` FOREIGN KEY (`campo_id`) REFERENCES `categoria_campos_adicionais` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificar se a tabela categorias existe (caso necessário)
CREATE TABLE IF NOT EXISTS `categorias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `recebe_termo` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mensagem de sucesso
SELECT 'Tabelas criadas com sucesso!' AS mensagem;
