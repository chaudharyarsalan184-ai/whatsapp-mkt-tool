import axios from 'axios';
import {
  META_API_VERSION,
  META_BUSINESS_ACCOUNT_ID,
  META_PHONE_NUMBER_ID,
  META_WHATSAPP_TOKEN,
} from '../config/env.js';

const graphBase = `https://graph.facebook.com/${META_API_VERSION}`;

function authHeaders() {
  return {
    Authorization: `Bearer ${META_WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export async function sendTemplateMessage(to, templateName, languageCode, bodyParameters) {
  const components = [];
  if (bodyParameters && bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParameters.map((p) =>
        typeof p === 'string' || (p && p.type === 'text')
          ? { type: 'text', text: p.text ?? p }
          : p
      ),
    });
  }
  let digits = String(to).replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits;
  const body = {
    messaging_product: 'whatsapp',
    to: digits,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode.replace('-', '_') },
      ...(components.length ? { components } : {}),
    },
  };
  const url = `${graphBase}/${META_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await axios.post(url, body, { headers: authHeaders() });
    return res.data;
  } catch (err) {
    console.error('Meta sendTemplateMessage error:', err.response?.data || err.message);
    throw err;
  }
}

export async function sendTextMessage(to, text) {
  let digits = String(to).replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits;
  const toField = digits;
  const body = {
    messaging_product: 'whatsapp',
    to: toField,
    type: 'text',
    text: { body: text },
  };
  const url = `${graphBase}/${META_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await axios.post(url, body, { headers: authHeaders() });
    return res.data;
  } catch (err) {
    console.error('Meta sendTextMessage error:', err.response?.data || err.message);
    throw err;
  }
}

function buildComponentsFromTemplate({ header_type, header_content, body, footer, buttons }) {
  const components = [];
  if (header_type && header_type !== 'NONE' && header_content) {
    const ht = header_type.toUpperCase();
    if (ht === 'TEXT') {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: header_content,
      });
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(ht)) {
      components.push({
        type: 'HEADER',
        format: ht,
        example: { header_handle: [header_content] },
      });
    }
  }
  components.push({
    type: 'BODY',
    text: body,
  });
  if (footer) {
    components.push({ type: 'FOOTER', text: footer });
  }
  const btnList = typeof buttons === 'string' ? JSON.parse(buttons || '[]') : buttons || [];
  if (btnList.length > 0) {
    const sub = btnList.slice(0, 3).map((b) => {
      if (b.type === 'URL') {
        return { type: 'URL', text: b.label, url: b.value };
      }
      return { type: 'QUICK_REPLY', text: b.label };
    });
    components.push({ type: 'BUTTONS', buttons: sub });
  }
  return components;
}

export async function submitTemplate(templateRow) {
  const name = templateRow.name.replace(/\s+/g, '_').toLowerCase();
  const category = templateRow.category;
  const language = (templateRow.language || 'en_US').replace('-', '_');
  const components = buildComponentsFromTemplate(templateRow);
  const payload = {
    name,
    language,
    category,
    components,
  };
  const url = `${graphBase}/${META_BUSINESS_ACCOUNT_ID}/message_templates`;
  try {
    const res = await axios.post(url, payload, { headers: authHeaders() });
    return { ...res.data, submittedName: name };
  } catch (err) {
    console.error('Meta submitTemplate error:', err.response?.data || err.message);
    throw err;
  }
}

export async function listTemplatesFromMeta() {
  const url = `${graphBase}/${META_BUSINESS_ACCOUNT_ID}/message_templates`;
  try {
    const res = await axios.get(url, {
      headers: authHeaders(),
      params: { limit: 100 },
    });
    return res.data;
  } catch (err) {
    console.error('Meta listTemplates error:', err.response?.data || err.message);
    throw err;
  }
}
