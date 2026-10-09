import type {
  AsaasPaymentPayload,
  AsaasPaymentResponse,
  AsaasPixQrCodeResponse,
  AsaasCustomerResponse,
  AsaasCustomerListResponse,
  AsaasCreateCustomerPayload,
  AsaasBoletoIdentificationFieldResponse,
} from '@/types/asaas.types';
import { asaasConfigurationReady } from '@/lib/config/asaas-environment.mjs';

export class AsaasClientError extends Error {
  public statusCode?: number;
  public errors?: Array<{ code: string; description: string }>;

  constructor(
    message: string,
    statusCode?: number,
    errors?: Array<{ code: string; description: string }>
  ) {
    super(message);
    this.name = 'AsaasClientError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export class AsaasClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  configurationReady(): boolean {
    return asaasConfigurationReady(process.env, this.baseUrl, this.apiKey);
  }

  constructor(apiUrl?: string, apiKey?: string) {
    this.baseUrl = (
      apiUrl || process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3'
    ).replace(/\/$/, '');
    this.apiKey = apiKey !== undefined ? apiKey : (process.env.ASAAS_API_KEY || '');

    // Bloqueio preventivo de segurança: Chave de produção nunca deve apontar para Sandbox
    if (this.apiKey.startsWith('$aact_prod_') && /(?:api-|\/\/)sandbox\.asaas\.com/.test(this.baseUrl)) {
      throw new AsaasClientError(
        'Configuração inválida de ambiente: Chave de produção do Asaas não pode ser utilizada com URL de Sandbox.',
        500
      );
    }
  }

  private get headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      access_token: this.apiKey,
      'User-Agent': 'Commerce/1.0',
    };
  }

  private async request(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new AsaasClientError('ASAAS_RESPONSE_TIMEOUT')), { once: true });
    });

    try {
      const response = await Promise.race([fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.headers,
          ...(options.headers || {}),
        },
      }), aborted]);
      // Keep the deadline active while the body is consumed too. Reading a
      // response header does not mean the provider completed its response.
      const data: unknown = response.status === 204 ? null : await Promise.race([response.json(), aborted]);
      const body = JSON.stringify(data);
      if (body.length > 2_000_000) throw new AsaasClientError('ASAAS_RESPONSE_TOO_LARGE');
      return new Response(response.status === 204 ? null : body, { status: response.status ?? (response.ok ? 200 : 500), headers: { 'Content-Type': 'application/json' } });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async listPaymentsByReference(reference: string): Promise<AsaasPaymentResponse[]> {
    const response = await this.request(this.baseUrl + '/payments?externalReference=' + encodeURIComponent(reference) + '&limit=100&offset=0');
    if (!response.ok) throw new AsaasClientError('PAYMENT_LOOKUP_UNAVAILABLE', response.status);
    const data = await response.json();
    if (!Array.isArray(data.data) || data.hasMore !== false) throw new AsaasClientError('PAYMENT_LOOKUP_INCOMPLETE');
    return data.data;
  }

  async cancelPayment(id: string): Promise<void> {
    const response = await this.request(this.baseUrl + '/payments/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!response.ok) throw new AsaasClientError('PAYMENT_CANCEL_UNRESOLVED', response.status);
  }

  async refundPayment(id: string, value: number): Promise<void> {
    const response = await this.request(this.baseUrl + '/payments/' + encodeURIComponent(id) + '/refund', { method: 'POST', body: JSON.stringify({ value }) });
    if (!response.ok) throw new AsaasClientError('PAYMENT_REFUND_UNRESOLVED', response.status);
  }

  async listPaymentRefunds(id: string): Promise<unknown> {
    const response = await this.request(this.baseUrl + '/payments/' + encodeURIComponent(id) + '/refunds?limit=100&offset=0');
    if (!response.ok) throw new AsaasClientError('PAYMENT_REFUND_LOOKUP_UNAVAILABLE', response.status);
    return response.json();
  }

  async listInstallmentPayments(id: string): Promise<AsaasPaymentResponse[]> {
    const response = await this.request(this.baseUrl + '/installments/' + encodeURIComponent(id) + '/payments?limit=100&offset=0');
    if (!response.ok) throw new AsaasClientError('INSTALLMENT_LOOKUP_UNAVAILABLE', response.status);
    const data = await response.json();
    if (!Array.isArray(data.data) || data.hasMore !== false) throw new AsaasClientError('INSTALLMENT_CONTRACT_INCOMPLETE');
    return data.data;
  }

  /**
   * Busca um cliente no Asaas pelo endereço de e-mail.
   */
  async findCustomerByEmail(email: string): Promise<AsaasCustomerResponse | null> {
    const url = `${this.baseUrl}/customers?email=${encodeURIComponent(email.trim().toLowerCase())}`;
    const res = await this.request(url, {
      method: 'GET',
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new AsaasClientError(
        `Falha ao buscar cliente no Asaas por e-mail: ${res.statusText}`,
        res.status,
        errorData.errors
      );
    }

    const data = (await res.json()) as AsaasCustomerListResponse;
    if (!data.data || data.data.length === 0) {
      return null;
    }

    return data.data.find((c) => !c.deleted) || null;
  }

  /**
   * Cria um novo cliente no Asaas com dados devidamente sanitizados.
   */
  async createCustomer(payload: AsaasCreateCustomerPayload): Promise<AsaasCustomerResponse> {
    const url = `${this.baseUrl}/customers`;

    const sanitizedPayload: Record<string, any> = {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
    };

    if (payload.phone) {
      const cleanPhone = payload.phone.replace(/\D/g, '');
      if (cleanPhone) sanitizedPayload.phone = cleanPhone;
    }

    if (payload.mobilePhone) {
      const cleanMobile = payload.mobilePhone.replace(/\D/g, '');
      if (cleanMobile) sanitizedPayload.mobilePhone = cleanMobile;
    }

    if (payload.cpfCnpj) {
      const cleanDoc = payload.cpfCnpj.replace(/\D/g, '');
      if (cleanDoc) sanitizedPayload.cpfCnpj = cleanDoc;
    }

    if (payload.notificationDisabled !== undefined) {
      sanitizedPayload.notificationDisabled = payload.notificationDisabled;
    }

    const res = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(sanitizedPayload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new AsaasClientError(
        `Falha ao criar cliente no Asaas: ${res.statusText}`,
        res.status,
        errorData.errors
      );
    }

    return (await res.json()) as AsaasCustomerResponse;
  }

  /**
   * Obtém o ID do cliente no Asaas (cus_...), localizando por e-mail ou criando novo registro.
   */
  async getOrCreateCustomer(payload: AsaasCreateCustomerPayload): Promise<string> {
    const existing = await this.findCustomerByEmail(payload.email);
    if (existing && existing.id) {
      return existing.id;
    }

    const created = await this.createCustomer(payload);
    return created.id;
  }

  /**
   * Cria uma cobrança no Asaas (PIX, Boleto ou Cartão).
   */
  async createPayment(payload: AsaasPaymentPayload): Promise<AsaasPaymentResponse> {
    const url = `${this.baseUrl}/payments`;
    const res = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new AsaasClientError(
        `Falha ao criar cobrança no Asaas: ${res.statusText}`,
        res.status,
        errorData.errors
      );
    }

    return (await res.json()) as AsaasPaymentResponse;
  }

  /**
   * Obtém QR Code e código Copia e Cola para pagamento PIX.
   */
  async getPixQrCode(paymentId: string): Promise<AsaasPixQrCodeResponse> {
    const url = `${this.baseUrl}/payments/${paymentId}/pixQrCode`;
    const res = await this.request(url, {
      method: 'GET',
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new AsaasClientError(
        `Falha ao obter PIX QR Code: ${res.statusText}`,
        res.status,
        errorData.errors
      );
    }

    return (await res.json()) as AsaasPixQrCodeResponse;
  }

  /**
   * Consulta os dados e o status de uma cobrança pelo ID do Asaas.
   */
  async getPayment(paymentId: string): Promise<AsaasPaymentResponse> {
    const url = `${this.baseUrl}/payments/${paymentId}`;
    const res = await this.request(url, {
      method: 'GET',
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new AsaasClientError(
        `Falha ao consultar cobrança ${paymentId}: ${res.statusText}`,
        res.status,
        errorData.errors
      );
    }

    return (await res.json()) as AsaasPaymentResponse;
  }

  /**
   * Obtém a linha digitável e o código de barras de um boleto bancário emitido.
   */
  async getBoletoIdentificationField(
    paymentId: string
  ): Promise<AsaasBoletoIdentificationFieldResponse> {
    const url = `${this.baseUrl}/payments/${paymentId}/identificationField`;
    const res = await this.request(url, {
      method: 'GET',
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new AsaasClientError(
        `Falha ao obter linha digitável do boleto ${paymentId}: ${res.statusText}`,
        res.status,
        errorData.errors
      );
    }

    return (await res.json()) as AsaasBoletoIdentificationFieldResponse;
  }
}

export const asaasClient = new AsaasClient();
