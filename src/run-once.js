import 'dotenv/config';
import { scrapeProducts } from './scraper.js';

/**
 * Script para executar o scraping uma vez (teste/debug)
 * Uso: node src/run-once.js
 */
const url = process.env.ON_URL || 'https://www.on.com/pt-br/shop/classics/mens/mens-size-12~mens-size-12.5~mens-size-8';

console.log('🔍 Executando scraping único...\n');

try {
  const products = await scrapeProducts(url);

  console.log(`\n📊 ${products.length} tênis encontrados:\n`);

  products.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} — ${p.color}`);
    const preco = p.precoAtual.replace(/,$/, '');
    const precoOrig = p.precoOriginal ? p.precoOriginal.replace(/,$/, '') : '';
    console.log(`   💰 ${preco}${precoOrig ? ` (de ${precoOrig}, -${p.desconto})` : ''}`);
    if (p.badge) console.log(`   🏷️ ${p.badge}`);
    console.log(`   🔗 ${p.url}`);
    console.log();
  });
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}
