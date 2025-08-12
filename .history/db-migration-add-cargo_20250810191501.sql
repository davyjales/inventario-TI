-- SQL to add cargo column to equipamentos table
ALTER TABLE equipamentos
ADD COLUMN cargo VARCHAR(255) DEFAULT NULL;
