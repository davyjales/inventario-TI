-- Corrigir estrutura do banco de dados para resolver os erros

-- 1. Verificar e corrigir tabela equipamentos
-- Verificar estrutura atual
PRAGMA table_info(equipamentos);

-- Se a tabela não existir, criar com estrutura correta
CREATE TABLE IF NOT EXISTS equipamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    dono TEXT NOT NULL,
    setor TEXT NOT NULL,
    descricao TEXT,
    termo TEXT,
    qrCode TEXT UNIQUE,
    hostname TEXT,
    status_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    FOREIGN KEY (status_id) REFERENCES status(id)
);

-- 2. Verificar e corrigir tabela equipment_history
-- Verificar estrutura atual
PRAGMA table_info(equipment_history);

-- Se a tabela não existir, criar com estrutura correta
CREATE TABLE IF NOT EXISTS equipment_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    changed_fields TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipamentos(id),
    FOREIGN KEY (user_id) REFERENCES usuarios(id)
);

-- 3. Criar tabelas auxiliares se não existirem
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    recebe_termo BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS equipamento_campos_adicionais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipamento_id INTEGER NOT NULL,
    nome_campo TEXT NOT NULL,
    valor TEXT,
    FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id)
);

CREATE TABLE IF NOT EXISTS categoria_campos_adicionais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER NOT NULL,
    nome_campo TEXT NOT NULL,
    tipo TEXT DEFAULT 'text',
    obrigatorio BOOLEAN DEFAULT 0,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- 4. Inserir status padrão se não existirem
INSERT OR IGNORE INTO status (id, nome) VALUES 
(1, 'Disponível'),
(2, 'Em uso'),
(3, 'Manutenção'),
(4, 'Descartado');

-- 5. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_equipamentos_categoria ON equipamentos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_status ON equipamentos(status_id);
CREATE INDEX IF NOT EXISTS idx_equipment_history_equipment ON equipment_history(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_history_timestamp ON equipment_history(timestamp);
