import { OrderPaymentConfirmedEmailParams } from '../email.types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function renderOrderPaymentConfirmedEmail(
  params: OrderPaymentConfirmedEmailParams
): { html: string; text: string } {
  const storeName = params.storeName || 'Continental Produtos Estéticos Automotivos';
  const cleanCustomerName = escapeHtml(params.customerName || 'Cliente');
  const firstName = cleanCustomerName.split(' ')[0];
  const formattedTotal = formatCurrency(params.totalValue);
  const formattedDate = formatDate(new Date(params.paymentDate));
  const orderUrl = params.orderUrl || '#';

  // Informações de entrega
  let shippingText = 'A Combinar';
  if (params.deliveryType === 'PICKUP') {
    shippingText = 'Retirada no Balcão';
  } else if (params.deliveryType === 'DELIVERY') {
    const service = params.shippingServiceName ? escapeHtml(params.shippingServiceName) : 'Entrega Padrão';
    const days = params.shippingEstimatedDays ? ` (Estimativa: ${params.shippingEstimatedDays} dias úteis)` : '';
    shippingText = `${service}${days}`;
  }

  // Geração de versão em texto puro
  const itemsTextList = params.items
    .map((item) => {
      const variantInfo = [item.color, item.size].filter(Boolean).join(' - ');
      const variantLabel = variantInfo ? ` (${variantInfo})` : '';
      return `- ${item.quantity}x ${item.name}${variantLabel} — ${formatCurrency(item.price * item.quantity)}`;
    })
    .join('\n');

  const pointsText = params.pointsEarned && params.pointsEarned > 0
    ? `\nVocê acumulou +${params.pointsEarned} pontos no programa de fidelidade Continental!`
    : '';

  const addressText = params.addressFormatted
    ? `\nEndereço de Entrega:\n${params.addressFormatted}\n`
    : '';

  const text = `Olá, ${firstName}!\n\nSeu pagamento no valor de ${formattedTotal} referente ao pedido #${params.orderNumber} foi aprovado com sucesso!\n\nDetalhes do Pedido #${params.orderNumber}:\nData da Confirmação: ${formattedDate}\nMétodo: PIX\nForma de Entrega: ${shippingText}${addressText}\nItens do Pedido:\n${itemsTextList}\n\nValor Total: ${formattedTotal}${pointsText}\n\nPara acompanhar o envio e status do seu pedido, acesse:\n${orderUrl}\n\nAgradecemos pela preferência!\nEquipe ${storeName}`;

  // Geração das linhas de itens em HTML
  const itemsHtmlRows = params.items
    .map((item) => {
      const cleanName = escapeHtml(item.name);
      const variantParts = [item.color, item.size].filter(Boolean).map((v) => escapeHtml(v!));
      const variantHtml = variantParts.length > 0
        ? `<div style="font-size: 12px; color: #888888; margin-top: 2px;">${variantParts.join(' / ')}</div>`
        : '';
      const itemSubtotal = formatCurrency(item.price * item.quantity);

      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #262626; color: #e5e5e5; font-size: 14px;">
            <div style="font-weight: 500;">${cleanName}</div>
            ${variantHtml}
            <div style="font-size: 12px; color: #a3a3a3; margin-top: 2px;">Qtd: ${item.quantity} × ${formatCurrency(item.price)}</div>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #262626; color: #ffffff; font-weight: 600; font-size: 14px; text-align: right; vertical-align: top;">
            ${itemSubtotal}
          </td>
        </tr>
      `;
    })
    .join('');

  // Banner de pontos de fidelidade
  const pointsBannerHtml = params.pointsEarned && params.pointsEarned > 0
    ? `
      <div style="margin-top: 20px; padding: 14px 16px; background-color: rgba(221, 175, 2, 0.08); border: 1px solid rgba(221, 175, 2, 0.3); border-radius: 8px; text-align: center;">
        <span style="color: #DDAF02; font-weight: 600; font-size: 14px;">★ Parabéns! Você ganhou +${params.pointsEarned} pontos de fidelidade nesta compra!</span>
      </div>
    `
    : '';

  // Bloco de endereço de entrega
  const addressHtml = params.addressFormatted
    ? `
      <div style="margin-top: 16px; padding: 12px 16px; background-color: #171717; border-radius: 8px; border: 1px solid #262626;">
        <div style="font-size: 12px; color: #888888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Endereço de Envio</div>
        <div style="font-size: 13px; color: #e5e5e5; line-height: 1.4;">${escapeHtml(params.addressFormatted)}</div>
      </div>
    `
    : '';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento Confirmado - Pedido #${params.orderNumber}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #080808;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e5e5e5;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #080808;
      padding: 32px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #121212;
      border: 1px solid #262626;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      padding: 32px 32px 24px;
      text-align: center;
      border-bottom: 1px solid #262626;
      background: linear-gradient(180deg, rgba(221, 175, 2, 0.12) 0%, rgba(18, 18, 18, 0) 100%);
    }
    .badge-status {
      display: inline-block;
      background-color: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #4ade80;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 12px;
    }
    .brand {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #ffffff;
      text-transform: uppercase;
    }
    .content {
      padding: 32px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 12px;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #a3a3a3;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .summary-card {
      background-color: #181818;
      border: 1px solid #282828;
      border-radius: 12px;
      padding: 18px 20px;
      margin-bottom: 24px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .button-container {
      text-align: center;
      margin: 32px 0 16px;
    }
    .button {
      display: inline-block;
      background-color: #DDAF02;
      color: #000000 !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 36px;
      border-radius: 10px;
      box-shadow: 0 4px 16px rgba(221, 175, 2, 0.35);
      letter-spacing: 0.3px;
    }
    .footer {
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #262626;
      font-size: 12px;
      color: #555555;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="badge-status">✔ Pagamento Aprovado</div>
        <div class="brand">${escapeHtml(storeName)}</div>
      </div>

      <div class="content">
        <h1>Obrigado pela sua compra, ${firstName}!</h1>
        <p>Confirmamos o recebimento do seu pagamento via PIX. Seu pedido já está sendo preparado pela nossa equipe com todo o cuidado.</p>

        <div class="summary-card">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #888888; padding: 4px 0;">Cliente:</td>
              <td style="color: #ffffff; text-align: right; padding: 4px 0;">${cleanCustomerName}</td>
            </tr>
            <tr>
              <td style="color: #888888; padding: 4px 0;">Número do Pedido:</td>
              <td style="color: #ffffff; font-weight: 600; text-align: right; padding: 4px 0;">#${params.orderNumber}</td>
            </tr>
            <tr>
              <td style="color: #888888; padding: 4px 0;">Data de Liquidação:</td>
              <td style="color: #e5e5e5; text-align: right; padding: 4px 0;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="color: #888888; padding: 4px 0;">Método de Pagamento:</td>
              <td style="color: #e5e5e5; text-align: right; padding: 4px 0;">PIX Dinâmico</td>
            </tr>
            <tr>
              <td style="color: #888888; padding: 4px 0;">Modalidade de Entrega:</td>
              <td style="color: #e5e5e5; text-align: right; padding: 4px 0;">${shippingText}</td>
            </tr>
          </table>
          ${addressHtml}
        </div>

        <div style="font-size: 14px; font-weight: 600; color: #ffffff; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Resumo dos Itens</div>
        <table class="items-table">
          ${itemsHtmlRows}
          <tr>
            <td style="padding: 16px 0 0; color: #ffffff; font-size: 16px; font-weight: 700;">Total Pago</td>
            <td style="padding: 16px 0 0; color: #DDAF02; font-size: 18px; font-weight: 700; text-align: right;">${formattedTotal}</td>
          </tr>
        </table>

        ${pointsBannerHtml}

        <div class="button-container">
          <a href="${escapeHtml(orderUrl)}" class="button" target="_blank">Acompanhar Pedido</a>
        </div>
      </div>

      <div class="footer">
        Você recebeu este e-mail porque realizou uma compra em ${escapeHtml(storeName)}.<br>
        Em caso de dúvidas, entre em contato com nosso atendimento pelo WhatsApp oficial.<br>
        © ${new Date().getFullYear()} ${escapeHtml(storeName)}. Todos os direitos reservados.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return { html, text };
}
