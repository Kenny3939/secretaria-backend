type WhatsAppSendResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: unknown };

function getWhatsAppConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    throw new Error('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en variables de entorno.');
  }
  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
  return { token, url };
}

// 1. FUNCIÓN BASE PARA ENVIAR (Privada para uso interno)
async function sendToMeta(data: any) {
  try {
    const { token, url } = getWhatsAppConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      return { ok: true, status: response.status } satisfies WhatsAppSendResult;
    } else {
      const raw = await response.text().catch(() => '');
      let errorData: unknown = raw;
      try {
        errorData = raw ? JSON.parse(raw) : raw;
      } catch {
        // mantener raw
      }
      console.error('❌ Meta rechazó el mensaje:', {
        status: response.status,
        error: errorData,
      });
      return { ok: false, status: response.status, error: errorData } satisfies WhatsAppSendResult;
    }
  } catch (error) {
    console.error('❌ Error de conexión con Meta:', error);
    return { ok: false, error } satisfies WhatsAppSendResult;
  }
}

// 2. ENVIAR TEXTO SIMPLE (La que ya usabas)
export async function enviarMensajeWhatsApp(to: string, body: string) {
  const data = { messaging_product: 'whatsapp', to, type: 'text', text: { body } };
  return await sendToMeta(data);
}

// 3. ENVIAR BOTONES (Máximo 3 botones)
export async function enviarBotonesWhatsApp(to: string, textBody: string, buttons: { id: string; title: string }[]) {
  const data = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: textBody },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title },
        })),
      },
    },
  };
  return await sendToMeta(data);
}

// 4. ENVIAR LISTA (Hasta 10 opciones)
export async function enviarListaWhatsApp(
  to: string,
  headerText: string,
  bodyText: string,
  buttonLabel: string,
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
) {
  const data = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: headerText },
      body: { text: bodyText },
      footer: { text: 'Selecciona una opción abajo' },
      action: {
        button: buttonLabel,
        sections: sections,
      },
    },
  };
  return await sendToMeta(data);
}

