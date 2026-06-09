import "server-only";

// IMPORTANTE: el dominio monexity-app.com debe estar verificado
// en el dashboard de Resend antes de que este remitente funcione.
// https://resend.com/domains

type SendInviteEmailParams = {
  to: string;
  companyName: string;
  role: string;
  code: string;
};

type SendInviteEmailResult =
  | { ok: true }
  | { ok: false; error: string };

function formatCode(code: string): string {
  if (code.length === 13) {
    return `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6, 9)}-${code.slice(9)}`;
  }
  return code;
}

function roleLabel(role: string): string {
  if (role === "owner") return "Dueño";
  if (role === "admin") return "Administrador";
  return "Vendedor";
}

export async function sendInviteEmail({
  to,
  companyName,
  role,
  code,
}: SendInviteEmailParams): Promise<SendInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY no está configurada." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://monexity-app.com";
  const formattedCode = formatCode(code);
  const roleName = roleLabel(role);
  const signUpUrl = `${appUrl}/auth/sign-up`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación a ${companyName}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;border:1px solid #e2e8f0;overflow:hidden;">

          <tr>
            <td style="padding:36px 36px 0;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8;">
                Invitación
              </p>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-0.03em;line-height:1.2;">
                Te invitaron a ${companyName}
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:#64748b;line-height:1.6;">
                Tienes una invitación para unirte como <strong style="color:#0f172a;">${roleName}</strong>.
                Usa el código de abajo para registrarte o ingresar.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 36px;">
              <div style="background:#f1f5f9;border-radius:16px;padding:20px 24px;text-align:center;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;">
                  Tu código de invitación
                </p>
                <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:700;letter-spacing:0.14em;color:#0f172a;">
                  ${formattedCode}
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${signUpUrl}"
                       style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:14px;letter-spacing:-0.01em;">
                      Crear cuenta en Monexity
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;text-align:center;line-height:1.5;">
                Si ya tienes cuenta, inicia sesión e ingresa el código en la sección de equipo.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 36px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#cbd5e1;text-align:center;">
                Este código expira en 7 días · Monexity
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Monexity <admin@monexity-app.com>",
        to: [to],
        subject: `Te invitaron a ${companyName} en Monexity`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: `Resend devolvió ${res.status}: ${body}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `Error de red al contactar Resend: ${String(err)}`,
    };
  }
}