import puppeteer from 'puppeteer';

const DEFAULT_URL = 'https://www.on.com/pt-br/shop/classics/mens/mens-size-12~mens-size-12.5~mens-size-8';

/**
 * Faz scraping dos tênis na página da On Running
 * @param {string} url - URL da página de produtos
 * @returns {Promise<Array>} Lista de produtos
 */
export async function scrapeProducts(url = DEFAULT_URL) {
  console.log(`🔍 Iniciando scraping: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // User agent realista
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1280, height: 800 });

    // Navega para a URL
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Espera os produtos carregarem (SPA precisa de tempo)
    await page.waitForSelector('a[aria-label]', { timeout: 30000 });

    // Espera extra para o SPA renderizar completamente
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Fecha qualquer pop-up de newsletter
    try {
      const closeButton = await page.$('button[aria-label="Close"]');
      if (closeButton) await closeButton.click();
    } catch {
      // Sem pop-up, ok
    }

    // Extrai produtos dos links com aria-label contendo "Preço"
    const products = await page.evaluate(() => {
      const productLinks = document.querySelectorAll('a[aria-label*="Preço"]');
      const items = [];

      productLinks.forEach((link) => {
        const ariaLabel = link.getAttribute('aria-label') || '';
        const href = link.getAttribute('href') || '';

        // Parseia o aria-label
        // Formato: "Nome, Cor, Gênero – Categorias, Preço atual R$ X, preço original R$ Y, Reduzido em Z%"
        // ou: "Nome, Cor, Gênero – Categorias, Preço atual R$ X"
        const parts = ariaLabel.split(',').map((s) => s.trim());

        const name = parts[0] || 'Sem nome';
        const color = parts[1] || '';

        // Busca preço atual
        const precoAtualMatch = ariaLabel.match(/Preço atual\s+(R\$\s*[\d.,]+)/i);
        const precoAtual = precoAtualMatch ? precoAtualMatch[1] : '';

        // Busca preço original (se existir)
        const precoOriginalMatch = ariaLabel.match(/preço original\s+(R\$\s*[\d.,]+)/i);
        const precoOriginal = precoOriginalMatch ? precoOriginalMatch[1] : '';

        // Busca desconto
        const descontoMatch = ariaLabel.match(/Reduzido em\s+(\d+%)/i);
        const desconto = descontoMatch ? descontoMatch[1] : '';

        // Busca badge (ex: Última chance, Novo)
        const badgeEl = link.querySelector('p span');
        const badge = badgeEl ? badgeEl.textContent.trim() : '';

        // URL da imagem
        const img = link.closest('div')?.querySelector('img');
        const imageUrl = img ? img.getAttribute('src') || '' : '';

        // Evita duplicatas (mesmo href)
        if (href && !items.find((i) => i.url === href)) {
          items.push({
            name,
            color: color.replace(/,$/, '').trim(),
            precoAtual: precoAtual.replace(/,$/, '').trim(),
            precoOriginal: precoOriginal.replace(/,$/, '').trim(),
            desconto,
            badge,
            url: href,
            imageUrl,
          });
        }
      });

      return items;
    });

    console.log(`✅ Encontrados ${products.length} tênis`);

    // Adiciona URL completa
    const baseUrl = 'https://www.on.com';
    return products.map((p) => ({
      ...p,
      url: p.url.startsWith('http') ? p.url : `${baseUrl}${p.url}`,
    }));
  } catch (error) {
    console.error('❌ Erro no scraping:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}
