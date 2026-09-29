-- Cria o banco de testes descartável se não existir
SELECT 'CREATE DATABASE ecommerce_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce_test')\gexec
