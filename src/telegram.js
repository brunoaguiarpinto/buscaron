const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Envia mensagem via Telegram Bot API
 * @param {string} text - Texto da mensagem (suporta HTML)
 * @param {string} token - Token do bot
 * @param {string} chatId - Chat ID do destinatário
 */
async function sendMessage(text, token, chatId) {
  const url = `${TELEGRAM_API}${token}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  return data;
}

/**
 * Divide texto longo em chunks de até maxLen chars
 */
function splitMessage(text, maxLen = 4096) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  const lines = text.split('\n');
  let current = '';

  for (const line of lines) {
    if ((current + '\n' + line).length > maxLen) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

/**
 * Formata um produto para mensagem Telegram
 */
function formatProduct(product) {
  let text = `👟 <b>${product.name}</b>`;

  if (product.color) text += ` — ${product.color}`;
  if (product.badge) text += ` 🏷️ <i>${product.badge}</i>`;

  text += '\n';

  if (product.precoOriginal && product.desconto) {
    text += `   💰 <b>${product.precoAtual}</b> <s>${product.precoOriginal}</s> (-${product.desconto})`;
  } else {
    text += `   💰 <b>${product.precoAtual}</b>`;
  }

  text += `\n   🔗 <a href="${product.url}">Ver produto</a>`;

  return text;
}

/**
 * Envia lista completa de produtos
 */
export async function sendProductList(products, token, chatId) {
  const header = `🏃 <b>BuscaOn — Tênis On Running</b>\n📅 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n📊 ${products.length} tênis encontrados\n${'─'.repeat(30)}\n`;

  const productTexts = products.map(formatProduct);
  const fullText = header + '\n' + productTexts.join('\n\n');

  const chunks = splitMessage(fullText);

  for (const chunk of chunks) {
    await sendMessage(chunk, token, chatId);
    // Delay entre mensagens para evitar rate limit
    if (chunks.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`📨 Enviadas ${chunks.length} mensagem(s) no Telegram`);
}

/**
 * Envia notificação de mudanças
 */
export async function sendChanges({ newProducts, removedProducts, priceChanges }, token, chatId) {
  let text = `🔔 <b>BuscaOn — Atualizações!</b>\n📅 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n${'─'.repeat(30)}\n`;

  if (newProducts.length > 0) {
    text += `\n🆕 <b>Novos produtos (${newProducts.length}):</b>\n\n`;
    text += newProducts.map(formatProduct).join('\n\n');
  }

  if (priceChanges.length > 0) {
    text += `\n\n💰 <b>Mudanças de preço (${priceChanges.length}):</b>\n\n`;
    for (const change of priceChanges) {
      text += `👟 <b>${change.name}</b>`;
      if (change.color) text += ` — ${change.color}`;
      text += `\n   ${change.oldPrice} → <b>${change.newPrice}</b>`;
      text += `\n   🔗 <a href="${change.url}">Ver produto</a>\n\n`;
    }
  }

  if (removedProducts.length > 0) {
    text += `\n❌ <b>Removidos (${removedProducts.length}):</b>\n\n`;
    for (const p of removedProducts) {
      text += `   • ${p.name}`;
      if (p.color) text += ` — ${p.color}`;
      text += '\n';
    }
  }

  const chunks = splitMessage(text);

  for (const chunk of chunks) {
    await sendMessage(chunk, token, chatId);
    if (chunks.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`📨 Notificação de mudanças enviada`);
}

/**
 * Envia mensagem simples
 */
export async function sendSimpleMessage(text, token, chatId) {
  return sendMessage(text, token, chatId);
}
