export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow'
    });

    const html = await response.text();

    // Extração de Título
    let title = '';
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitle && ogTitle[1]) {
      title = ogTitle[1];
    } else {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) title = titleMatch[1];
    }

    // Extração de Imagem
    let image = '';
    const ogImg = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImg && ogImg[1]) {
      image = ogImg[1];
    }

    // Extração de Preços (De e Por)
    let priceDe = '';
    let pricePor = '';

    // 1. Preço 'De' (Riscado / Anterior)
    const deTag = html.match(/<span[^>]*class="[^"]*andes-money-amount--previous[^"]*"[^>]*>[\s\S]*?<\/span>\s*<\/span>/i) ||
                  html.match(/<s[^>]*>[\s\S]*?<\/s>/i) ||
                  html.match(/<span[^>]*class="[^"]*ui-pdp-price__original-value[^"]*"[^>]*>[\s\S]*?<\/span>/i);

    if (deTag) {
      const deFrac = deTag[0].match(/andes-money-amount__fraction[^>]*>([0-9\.\,]+)<\/span>/i);
      const deCents = deTag[0].match(/andes-money-amount__cents[^>]*>([0-9]+)<\/span>/i);
      if (deFrac && deFrac[1]) {
        let pDe = deFrac[1].replace(/\./g, '');
        let cDe = deCents ? deCents[1] : '00';
        if (cDe.length === 1) cDe += '0';
        priceDe = `${pDe},${cDe}`;
      }
    }

    // 2. Preço 'Por' (Preço Atual com Desconto)
    // Extrai o bloco da segunda linha / linha principal sem vazar para o resto da página
    const secondLine = html.match(/class="[^"]*ui-pdp-price__second-line[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       html.match(/class="[^"]*ui-pdp-price__main-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    const priceBlock = secondLine ? secondLine[1] : html;

    // Pega estritamente a tag andes-money-amount do preço com desconto
    const porTag = priceBlock.match(/<span[^>]*class="[^"]*andes-money-amount(?![^"]*previous)[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/i) ||
                   priceBlock.match(/<span[^>]*class="[^"]*andes-money-amount[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/i);

    if (porTag) {
      const porFrac = porTag[0].match(/andes-money-amount__fraction[^>]*>([0-9\.\,]+)<\/span>/i);
      const porCents = porTag[0].match(/andes-money-amount__cents[^>]*>([0-9]+)<\/span>/i);
      if (porFrac && porFrac[1]) {
        let pPor = porFrac[1].replace(/\./g, '');
        let cPor = porCents ? porCents[1] : '00';
        if (cPor.length === 1) cPor += '0';
        pricePor = `${pPor},${cPor}`;
      }
    } else {
      const porFrac = priceBlock.match(/andes-money-amount__fraction[^>]*>([0-9\.\,]+)<\/span>/i);
      if (porFrac && porFrac[1]) {
        let pPor = porFrac[1].replace(/\./g, '');
        pricePor = `${pPor},00`;
      }
    }

    // Se os dois preços forem iguais por erro de seletor, limpa o 'De'
    if (priceDe && pricePor && priceDe === pricePor) {
      priceDe = '';
    }

    return res.status(200).json({
      status: 'success',
      data: {
        title,
        image,
        priceDe,
        pricePor
      }
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
