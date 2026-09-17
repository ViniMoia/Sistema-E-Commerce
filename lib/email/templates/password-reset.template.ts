import { PasswordResetEmailParams } from "../email.types";

export function renderPasswordResetEmail(params: PasswordResetEmailParams): { html: string; text: string } {
  const storeName = params.storeName || "Continental Produtos Estéticos Automotivos";
  const firstName = params.name ? params.name.split(" ")[0] : "Cliente";

  const text = `Olá, ${firstName}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta na ${storeName}.\n\nPara cadastrar uma nova senha, acesse o link abaixo (válido por 1 hora):\n${params.resetUrl}\n\nSe você não solicitou a redefinição de senha, ignore esta mensagem. Sua conta permanece segura.\n\nAtenciosamente,\nEquipe ${storeName}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de Senha - ${storeName}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #050505;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e5e5e5;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #050505;
      padding: 40px 0;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #121212;
      border: 1px solid #262626;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    .header {
      padding: 32px 32px 24px;
      text-align: center;
      border-bottom: 1px solid #262626;
      background: linear-gradient(180deg, rgba(219, 181, 1, 0.08) 0%, rgba(18, 18, 18, 0) 100%);
    }
    .brand {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #ffffff;
      text-transform: uppercase;
    }
    .content {
      padding: 32px;
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 16px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #a3a3a3;
      margin-bottom: 24px;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background-color: #dbb501;
      color: #000000;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(219, 181, 1, 0.3);
      letter-spacing: 0.3px;
    }
    .note {
      font-size: 13px;
      color: #737373;
      line-height: 1.5;
      padding: 16px;
      background-color: #171717;
      border-left: 3px solid #dbb501;
      border-radius: 6px;
      margin-top: 24px;
    }
    .footer {
      padding: 24px 32px;
      text-align: center;
      border-top: 1px solid #262626;
      font-size: 12px;
      color: #525252;
    }
    .link-alt {
      font-size: 12px;
      word-break: break-all;
      color: #dbb501;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="brand">${storeName}</div>
      </div>
      <div class="content">
        <h1>Redefinição de Senha</h1>
        <p>Olá, <strong>${firstName}</strong>,</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta de acesso. Para definir uma nova senha com segurança, clique no botão abaixo:</p>
        
        <div class="button-container">
          <a href="${params.resetUrl}" class="button" target="_blank">Redefinir Minha Senha</a>
        </div>

        <div class="note">
          <strong>Atenção:</strong> Este link é de uso único e expira automaticamente em <strong>1 hora</strong>.<br/>
          Caso você não tenha solicitado esta alteração, fique tranquilo: nenhuma alteração foi realizada e sua conta permanece totalmente segura.
        </div>

        <p style="margin-top: 24px; font-size: 12px; color: #737373;">
          Se o botão não funcionar, copie e cole o link a seguir em seu navegador:<br/>
          <a href="${params.resetUrl}" class="link-alt">${params.resetUrl}</a>
        </p>
      </div>
      <div class="footer">
        © ${new Date().getFullYear()} ${storeName}. Todos os direitos reservados.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { html, text };
}
