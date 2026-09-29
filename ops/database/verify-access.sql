-- Verificação SOMENTE LEITURA. Execute apenas em ambiente autorizado.
-- O resultado contém nomes de roles e objetos, mas não deve conter credenciais.

SELECT
  namespace.nspname AS schemaname,
  relation.relname AS tablename,
  relation.relrowsecurity AS rowsecurity,
  relation.relforcerowsecurity AS forcerowsecurity
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p')
ORDER BY relation.relname;

SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, table_name, privilege_type;

SELECT
  rolname,
  rolsuper,
  rolbypassrls,
  rolcanlogin
FROM pg_roles
WHERE rolname IN (current_user, 'anon', 'authenticated', 'service_role')
ORDER BY rolname;

SELECT
  defaclrole::regrole AS owner,
  defaclnamespace::regnamespace AS schema_name,
  defaclobjtype AS object_type,
  defaclacl AS privileges
FROM pg_default_acl
ORDER BY 1, 2, 3;
