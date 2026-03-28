import 'dotenv/config';
import cron from 'node-cron';
import { scrapeProducts } from './scraper.js';
import { sendProductList, sendChanges, sendSimpleMessage } from './telegram.js';
import { loadProducts, saveProducts, compareProducts, logScan, logPriceChanges } from './storage.js';

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  ON_URL = 'https://www.on.com/pt-br/shop/classics/mens/mens-size-12~mens-size-12.5~mens-size-8',
} = process.env;

// Validação de configuração
if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'seu_token_aqui') {
  console.error('❌ Configure TELEGRAM_BOT_TOKEN no arquivo .env');
  console.error('   1. Fale com @BotFather no Telegram');
  console.error('   2. Crie um bot com /newbot');
  console.error('   3. Copie o token para o .env');
  process.exit(1);
}

if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === 'seu_chat_id_aqui') {
  console.error('❌ Configure TELEGRAM_CHAT_ID no arquivo .env');
  console.error('   1. Envie uma mensagem ao seu bot no Telegram');
  console.error(`   2. Acesse: https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`);
  console.error('   3. Copie o chat.id para o .env');
  process.exit(1);
}

/**
 * Executa o ciclo de scraping + notificação
 */
async function runCheck() {
  const startTime = Date.now();
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  console.log(`${'═'.repeat(50)}`);

  try {
    // 1. Faz scraping
    const products = await scrapeProducts(ON_URL);

    if (products.length === 0) {
      console.log('⚠️ Nenhum produto encontrado. Pode ser um problema temporário.');
      await sendSimpleMessage(
        '⚠️ <b>BuscaOn:</b> Nenhum produto encontrado na última verificação. Pode ser um problema temporário do site.',
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID
      );
      return;
    }

    // 2. Carrega produtos anteriores do Supabase
    const previousProducts = await loadProducts();


    // 3. Compara
    const changes = compareProducts(products, previousProducts);

    // 4. Notifica
    if (changes.isFirstRun) {
      console.log('🚀 Primeira execução — enviando lista completa');
      await sendProductList(products, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
    } else if (changes.hasChanges) {
      console.log(
        `📢 Mudanças detectadas: ${changes.newProducts.length} novos, ${changes.removedProducts.length} removidos, ${changes.priceChanges.length} preços alterados`
      );
      await sendChanges(changes, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
      // Registra mudanças de preço no histórico
      await logPriceChanges(changes.priceChanges);
    } else {
      console.log('✅ Sem novidades — nenhuma mudança detectada');
    }

    // 5. Salva produtos atuais no Supabase
    await saveProducts(products);

    // 6. Registra log da execução
    await logScan({
      productsFound: products.length,
      newProducts: changes.isFirstRun ? products.length : changes.newProducts.length,
      removedProducts: changes.isFirstRun ? 0 : changes.removedProducts.length,
      priceChanges: changes.isFirstRun ? 0 : changes.priceChanges.length,
      status: 'success',
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`⏱️ Verificação concluída em ${elapsed}s`);
  } catch (error) {
    console.error('❌ Erro na verificação:', error.message);
    // Registra erro no log
    await logScan({ status: 'error', errorMessage: error.message });
    try {
      await sendSimpleMessage(
        `❌ <b>BuscaOn Erro:</b> ${error.message}`,
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID
      );
    } catch {
      console.error('❌ Não foi possível enviar erro via Telegram');
    }
  }
}

// ═══════════════════════════════════════════
// Inicia o app
// ═══════════════════════════════════════════
console.log('🏃 BuscaOn — Monitoramento de Tênis On Running');
console.log(`📌 URL: ${ON_URL}`);
console.log(`⏰ Agendado para rodar a cada 12h (08:00 e 20:00)`);
console.log(`${'─'.repeat(50)}`);

// Executa imediatamente na primeira vez
runCheck();

// Agenda a cada 12 horas (8h e 20h, horário de São Paulo)
cron.schedule('0 8,20 * * *', () => {
  console.log('\n⏰ Execução agendada disparada');
  runCheck();
}, {
  timezone: 'America/Sao_Paulo',
});

console.log('🟢 Cron agendado. Processo rodando...');
