/** Configuration preflight only. Never activates a flag or contacts a provider. */
import { asaasGatewayTarget, expectedAsaasEnvironment, asaasConfigurationReady } from '../../lib/config/asaas-environment.mjs';

export function checkProductionEnvironment(env, declaration = {}) {
  const issues = [];
  const remoteEnabled = env.PAYMENT_REMOTE_ENABLED === 'true';
  const workerEnabled = env.PAYMENT_WORKER_ENABLED === 'true';
  const expirationEnabled = env.PAYMENT_EXPIRATION_ENABLED === 'true';
  const issue = (code, severity, description) => issues.push({ code, severity, description });
  if (env.TEST_RUN_ID || env.TEST_DATABASE_URL || env.TEST_HTTP_TOKEN) {
    issue('TEST_ENVIRONMENT_NOT_A_RELEASE', 'ERROR', 'Ambiente de fixtures não pode receber aceite de configuração de release.');
  }
  if ((env.FREIGHT_QUOTE_SECRET?.length ?? 0) < 32) {
    issue('FREIGHT_QUOTE_SECRET_MISSING', 'ERROR', 'Configurar chave de assinatura com pelo menos32 caracteres, compartilhada pelas instâncias.');
  }
  const runtimeEnv = { ...env, NODE_ENV: 'production' };
  const gatewayTarget = asaasGatewayTarget(env.ASAAS_API_URL);
  const expectedGatewayTarget = expectedAsaasEnvironment(runtimeEnv);
  if (declaration.nonempty && declaration.unescapedDollarReference && !env.ASAAS_API_KEY) {
    issue('ASAAS_KEY_REMOVED_BY_ENV_EXPANSION', remoteEnabled ? 'ERROR' : 'WARNING',
      'A chave declarada ficou vazia após expansão do Next.js. Preservar dólar literal conforme contrato dotenv; não ativar pagamentos para diagnosticar.');
  }
  if (remoteEnabled) {
    if (!asaasConfigurationReady(runtimeEnv, env.ASAAS_API_URL, env.ASAAS_API_KEY)) {
      issue(expectedGatewayTarget === 'PRODUCTION' ? 'ASAAS_PRODUCTION_CONFIGURATION_MISSING' : 'ASAAS_SANDBOX_CONFIGURATION_MISSING', 'ERROR',
        'Endpoint e prefixo de chave devem corresponder ao ambiente: Preview Vercel identificado usa Sandbox; outros runtimes otimizados usam produção. Presença não valida credencial/conta ou autoriza operação.');
    }
    if (!(env.ASAAS_ENABLED_LOJA_IDS ?? '').split(',').some(id => id.trim())) {
      issue('ASAAS_TENANT_ALLOWLIST_MISSING', 'ERROR', 'Pagamentos remotos requerem allowlist explícita de lojas homologadas.');
    }
    if (!env.ASAAS_WEBHOOK_TOKEN?.trim()) issue('ASAAS_WEBHOOK_TOKEN_MISSING', 'ERROR', 'Configurar autenticação do webhook antes de habilitar o método remoto.');
  }
  if ((workerEnabled || expirationEnabled) && !env.CRON_SECRET?.trim()) {
    issue('CRON_AUTHENTICATION_MISSING', 'ERROR', 'Executor/expiração requerem autenticação de cron; scheduler e alertas ainda precisam de ensaio próprio.');
  }
  return { configurationOnly: true, configurationPassed: !issues.some(item => item.severity === 'ERROR'),
    productionReady: false, gatewayTarget, expectedGatewayTarget, remoteEnabled, workerEnabled, expirationEnabled,
    issues, externalCalls: 0, mutations: 0 };
}
