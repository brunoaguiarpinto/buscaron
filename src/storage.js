import { supabase } from './supabase.js';

/**
 * Carrega todos os produtos disponíveis do Supabase
 * @returns {Promise<Array>} Lista de produtos salvos ou []
 */
export async function loadProducts() {
  try {
    const { data, error } = await supabase
      .from('on_products')
      .select('*')
      .eq('is_available', true)
      .order('name');

    if (error) {
      console.error('❌ Erro ao carregar produtos:', error.message);
      return [];
    }

    // Mapeia para o formato usado pelo app
    return (data || []).map((row) => ({
      name: row.name,
      color: row.color,
      precoAtual: row.preco_atual,
      precoOriginal: row.preco_original,
      desconto: row.desconto,
      badge: row.badge,
      url: row.url,
      imageUrl: row.image_url,
    }));
  } catch {
    console.error('❌ Erro de conexão ao carregar produtos');
    return [];
  }
}

/**
 * Salva produtos no Supabase via UPSERT (insert ou update por URL)
 * @param {Array} products - Lista de produtos do scraper
 */
export async function saveProducts(products) {
  try {
    // 1. Upsert dos produtos encontrados
    const rows = products.map((p) => ({
      name: p.name,
      color: p.color,
      preco_atual: p.precoAtual,
      preco_original: p.precoOriginal,
      desconto: p.desconto,
      badge: p.badge,
      url: p.url,
      image_url: p.imageUrl,
      is_available: true,
    }));

    const { error } = await supabase
      .from('on_products')
      .upsert(rows, { onConflict: 'url' });

    if (error) {
      console.error('❌ Erro ao salvar produtos:', error.message);
      return;
    }

    // 2. Marca como indisponível os que não estão mais na listagem
    const currentUrls = products.map((p) => p.url);

    const { error: updateError } = await supabase
      .from('on_products')
      .update({ is_available: false })
      .eq('is_available', true)
      .not('url', 'in', `(${currentUrls.map((u) => `"${u}"`).join(',')})`);

    if (updateError) {
      console.error('⚠️ Erro ao marcar produtos indisponíveis:', updateError.message);
    }

    console.log(`💾 ${products.length} produtos salvos no Supabase`);
  } catch (err) {
    console.error('❌ Erro de conexão ao salvar produtos:', err.message);
  }
}

/**
 * Compara produtos atuais com anteriores e detecta mudanças
 * @param {Array} currentProducts - Produtos encontrados agora
 * @param {Array} previousProducts - Produtos salvos anteriormente
 * @returns {Object} { newProducts, removedProducts, priceChanges, hasChanges, isFirstRun }
 */
export function compareProducts(currentProducts, previousProducts) {
  if (!previousProducts || previousProducts.length === 0) {
    return {
      newProducts: currentProducts,
      removedProducts: [],
      priceChanges: [],
      hasChanges: true,
      isFirstRun: true,
    };
  }

  // Cria mapas por URL para comparação eficiente
  const prevMap = new Map(previousProducts.map((p) => [p.url, p]));
  const currMap = new Map(currentProducts.map((p) => [p.url, p]));

  // Novos produtos (estão no atual mas não no anterior)
  const newProducts = currentProducts.filter((p) => !prevMap.has(p.url));

  // Produtos removidos (estavam antes mas não estão mais)
  const removedProducts = previousProducts.filter((p) => !currMap.has(p.url));

  // Mudanças de preço
  const priceChanges = [];
  for (const [url, curr] of currMap) {
    const prev = prevMap.get(url);
    if (prev && prev.precoAtual !== curr.precoAtual) {
      priceChanges.push({
        name: curr.name,
        color: curr.color,
        url: curr.url,
        oldPrice: prev.precoAtual,
        newPrice: curr.precoAtual,
      });
    }
  }

  const hasChanges =
    newProducts.length > 0 || removedProducts.length > 0 || priceChanges.length > 0;

  return { newProducts, removedProducts, priceChanges, hasChanges, isFirstRun: false };
}

/**
 * Registra log de uma execução do scraper
 * @param {Object} scanData - Dados da execução
 */
export async function logScan(scanData) {
  try {
    const { error } = await supabase.from('on_scan_logs').insert({
      products_found: scanData.productsFound || 0,
      new_products: scanData.newProducts || 0,
      removed_products: scanData.removedProducts || 0,
      price_changes: scanData.priceChanges || 0,
      status: scanData.status || 'success',
      error_message: scanData.errorMessage || null,
    });

    if (error) {
      console.error('⚠️ Erro ao salvar log:', error.message);
    }
  } catch {
    console.error('⚠️ Erro de conexão ao salvar log');
  }
}

/**
 * Registra mudanças de preço no histórico
 * @param {Array} priceChanges - Lista de mudanças de preço
 */
export async function logPriceChanges(priceChanges) {
  if (!priceChanges || priceChanges.length === 0) return;

  try {
    const rows = priceChanges.map((change) => ({
      product_url: change.url,
      old_price: change.oldPrice,
      new_price: change.newPrice,
    }));

    const { error } = await supabase.from('on_price_history').insert(rows);

    if (error) {
      console.error('⚠️ Erro ao salvar histórico de preços:', error.message);
    } else {
      console.log(`📊 ${priceChanges.length} mudanças de preço registradas`);
    }
  } catch {
    console.error('⚠️ Erro de conexão ao salvar histórico de preços');
  }
}
