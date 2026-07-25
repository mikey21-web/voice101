import { Injectable } from '@nestjs/common';

const HTTP_TIMEOUT_MS = parseInt(process.env.MESSAGING_HTTP_TIMEOUT || process.env.WHATSAPP_HTTP_TIMEOUT || '10000', 10);

async function fetchWithTimeout(url: string, init: any = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface MessagingAdapter {
  sendMessage(to: string, text: string, config: any): Promise<{ success: boolean; messageId?: string; error?: string }>;
  healthCheck(config: any): Promise<boolean>;
}

interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  parameters?: Array<{ type: 'text' | 'image' | 'document' | 'video'; text?: string; image?: { link: string }; document?: { link: string; filename?: string }; video?: { link: string } }>;
}

@Injectable()
export class WhatsAppCloudAdapter implements MessagingAdapter {
  async sendMessage(to: string, text: string, config: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const provider = config?.whatsappProvider || process.env.WHATSAPP_PROVIDER || 'meta';
    if (provider === 'wasender') {
      return this.sendWasender(to, text, config);
    }
    if (provider === 'openwa') {
      return this.sendOpenwa(to, text, config);
    }
    const phoneNumberId = config?.phoneNumberId || config?.WHATSAPP_PHONE_NUMBER_ID;
    const token = config?.accessToken || config?.WHATSAPP_ACCESS_TOKEN;
    const within24h = config?.within24h !== false;
    const templateId = config?.templateId;
    const templateLang = config?.templateLang || 'en';
    const templateComponents = config?.templateComponents as WhatsAppTemplateComponent[] | undefined;
    const mediaUrl = config?.mediaUrl;
    const mediaType = config?.mediaType;
    const interactiveType = config?.interactiveType;
    const interactiveBody = config?.interactiveBody;
    const interactiveButtons = config?.interactiveButtons as Array<{ id: string; title: string }> | undefined;
    const interactiveSections = config?.interactiveSections as Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }> | undefined;

    if (!phoneNumberId || !token) return { success: false, error: 'WhatsApp credentials not configured' };

    if (!within24h && !templateId) {
      return { success: false, error: 'Outside 24h window — a template message is required' };
    }

    try {
      let body: any;

      if (!within24h && templateId) {
        body = {
          messaging_product: 'whatsapp', to, type: 'template',
          template: { name: templateId, language: { code: templateLang } },
        };
        if (templateComponents?.length) {
          body.template.components = templateComponents;
        }
      } else if (mediaUrl && mediaType) {
        const caption = config?.caption || (mediaType !== 'audio' ? text : undefined);
        const mediaObj: any = { link: mediaUrl };
        if (caption) mediaObj.caption = caption;
        // WhatsApp requires a filename for documents; without it the file
        // downloads as an opaque blob on the recipient's phone.
        if (mediaType === 'document' && config?.fileName) mediaObj.filename = config.fileName;
        body = {
          messaging_product: 'whatsapp', to, type: mediaType,
          [mediaType]: mediaObj,
        };
      } else if (interactiveType === 'button' && interactiveBody && interactiveButtons) {
        body = {
          messaging_product: 'whatsapp', to, type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: interactiveBody },
            action: { buttons: interactiveButtons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
          },
        };
      } else if (interactiveType === 'list' && interactiveBody && interactiveSections) {
        body = {
          messaging_product: 'whatsapp', to, type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: interactiveBody },
            action: { sections: interactiveSections },
          },
        };
      } else {
        body = { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } };
      }

      const res = await fetchWithTimeout(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.error?.message || `HTTP ${res.status}` };
      return { success: true, messageId: json.messages?.[0]?.id };
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  private async sendWasender(to: string, text: string, config: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const token = config?.accessToken || config?.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) return { success: false, error: 'Wasender API token not configured' };
    try {
      const res = await fetchWithTimeout('https://wasenderapi.com/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to, text }),
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.error || json.message || `HTTP ${res.status}` };
      return { success: true, messageId: json.data?.msgId?.toString() || json.messageId || json.id || json.data?.messageId };
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  private async sendOpenwa(to: string, text: string, config: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const baseUrl = config?.openwaUrl || process.env.OPENWA_URL;
    const apiKey = config?.openwaApiKey || process.env.OPENWA_API_KEY;
    const sessionId = config?.openwaSessionId || process.env.OPENWA_SESSION_ID;
    if (!baseUrl || !apiKey || !sessionId) return { success: false, error: 'OpenWA credentials not configured' };

    const chatId = to.includes('@') ? to : `${to.replace(/[^0-9]/g, '')}@c.us`;
    const mediaUrl = config?.mediaUrl;
    const mediaType = config?.mediaType;

    try {
      const mediaEndpoints: Record<string, string> = { image: 'send-image', video: 'send-video', document: 'send-document', audio: 'send-audio' };
      const path = mediaUrl && mediaType && mediaEndpoints[mediaType] ? mediaEndpoints[mediaType] : 'send-text';
      const body = mediaUrl && mediaType && mediaEndpoints[mediaType]
        ? { chatId, url: mediaUrl, caption: config?.caption || text, filename: config?.fileName }
        : { chatId, text };

      const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/sessions/${sessionId}/messages/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.message || `HTTP ${res.status}` };
      return { success: true, messageId: json.messageId };
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async healthCheck(config: any): Promise<boolean> {
    const provider = config?.whatsappProvider || process.env.WHATSAPP_PROVIDER || 'meta';
    if (provider === 'openwa') {
      const baseUrl = config?.openwaUrl || process.env.OPENWA_URL;
      const apiKey = config?.openwaApiKey || process.env.OPENWA_API_KEY;
      const sessionId = config?.openwaSessionId || process.env.OPENWA_SESSION_ID;
      if (!baseUrl || !apiKey || !sessionId) return false;
      try {
        const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/sessions/${sessionId}`, {
          headers: { 'X-API-Key': apiKey },
        });
        return res.ok;
      } catch { return false; }
    }
    if (provider === 'wasender') {
      const token = config?.accessToken || config?.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
      if (!token) return false;
      try {
        const res = await fetch('https://wasenderapi.com/api/send-message', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ to: 'validate', text: '' }) });
        return res.status !== 401 && res.status !== 422;
      } catch { return false; }
    }
    const token = config?.accessToken || config?.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = config?.phoneNumberId || config?.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) return false;
    try {
      const res = await fetchWithTimeout(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages?access_token=${token}`, {
        method: 'GET',
      });
      return res.ok;
    } catch { return false; }
  }
}

@Injectable()
export class TelegramBotAdapter implements MessagingAdapter {
  async sendMessage(to: string, text: string, config?: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const token = config?.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { success: false, error: 'Telegram bot token not configured' };
    const mediaUrl = config?.mediaUrl;
    const mediaType = config?.mediaType;
    try {
      const mediaMethods: Record<string, { method: string; field: string }> = {
        image: { method: 'sendPhoto', field: 'photo' },
        video: { method: 'sendVideo', field: 'video' },
        document: { method: 'sendDocument', field: 'document' },
        audio: { method: 'sendAudio', field: 'audio' },
      };
      const media = mediaUrl && mediaType ? mediaMethods[mediaType] : undefined;
      const endpoint = media ? media.method : 'sendMessage';
      const body: any = media
        ? { chat_id: to, [media.field]: mediaUrl, caption: config?.caption || text, parse_mode: 'Markdown' }
        : { chat_id: to, text, parse_mode: 'Markdown' };

      const send = () => fetchWithTimeout(`https://api.telegram.org/bot${token}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let res = await send();
      let json = await res.json().catch(() => null);
      // Telegram intermittently 400s ("wrong type of the web page content") when
      // fetching a media URL shortly after fetching a different one for the same
      // chat. A single short retry wasn't enough in practice; back off harder.
      const delays = [2000, 5000];
      for (const delay of delays) {
        if (res.ok || !media || !json?.description?.includes('wrong type of the web page content')) break;
        await new Promise(r => setTimeout(r, delay));
        res = await send();
        json = await res.json().catch(() => null);
      }
      if (!res.ok) return { success: false, error: `Telegram API error: ${res.status} ${json?.description || ''}`.trim() };
      return { success: true, messageId: json?.result?.message_id?.toString() };
    } catch (e: any) { return { success: false, error: e.message }; }
  }

  async healthCheck(config?: any): Promise<boolean> {
    const token = config?.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;
    try {
      const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/getMe`);
      return res.ok;
    } catch { return false; }
  }
}
