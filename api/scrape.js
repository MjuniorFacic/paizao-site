export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    let finalUrl = url;
    let html = '';

    // Se for link do AppsFlyer (Magazine Luiza onelink)
    if (url.includes('onelink.me')) {
      const resOnelink = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        },
        redirect: 'manual'
      });
      const loc = resOnelink.headers.get('location');
      if (loc) finalUrl = loc;
    }

    const response = await fetch(finalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow'
    });

    html = await response.text();

    // Extração de Título
    let title = '';
    const amazonTitle = html.match(/id=["']productTitle["'][^>]*>([^<]+)<\/span>/i);
    if (amazonTitle && amazonTitle[1]) {
      title = amazonTitle[1].trim();
    } else {
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogTitle && ogTitle[1] && !ogTitle[1].includes('Não é possível') && !ogTitle[1].includes('Acesso negado')) {
        title = ogTitle[1];
      } else {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1] && !titleMatch[1].includes('Não é possível') && !titleMatch[1].includes('Acesso negado')) {
          title = titleMatch[1];
        }
      }
    }

    // Se o título não veio no HTML ou foi bloqueado pelo Cloudflare, extrai do próprio slug da URL
    if (!title && finalUrl.includes('/p/')) {
      const cleanPath = finalUrl.split('?')[0];
      const parts = cleanPath.split('/p/')[0].split('/');
      const slugProduct = parts[parts.length - 1];
      if (slugProduct && !/^\d+$/.test(slugProduct) && slugProduct.length > 3) {
        title = slugProduct.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }

    if (title) {
      title = title.replace(/\s*:\s*Amazon\.com\.br.*$/i, '')
                   .replace(/\s*\|\s*Amazon\.com\.br.*$/i, '')
                   .trim();
    }

    // Extração de Imagem (com suporte a imagens em alta definição da Amazon e ML)
    let image = '';
    const amazonImg = html.match(/data-old-hires=["'](https:\/\/[^"']+)["']/i) ||
                      html.match(/id=["']landingImage["'][^>]*src=["'](https:\/\/[^"']+)["']/i) ||
                      html.match(/data-a-dynamic-image=["']\{["'](https:\/\/[^"']+)["']/i) ||
                      html.match(/"hiRes":\s*"(https:\/\/[^"]+)"/i) ||
                      html.match(/"large":\s*"(https:\/\/[^"]+)"/i);
    if (amazonImg) {
      image = amazonImg[1] || amazonImg[2] || amazonImg[3] || amazonImg[4] || amazonImg[5] || '';
    } else {
      const ogImg = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogImg && ogImg[1]) {
        image = ogImg[1];
      }
    }

    // Extração de Preços (De e Por)
    function parseAriaPrice(str) {
      if (!str) return '';
      const reaisMatch = str.match(/([0-9\.\,]+)\s*reais?/i);
      if (!reaisMatch) return '';
      let reais = reaisMatch[1].replace(/\./g, '');
      const centsMatch = str.match(/com\s*([0-9]+)\s*centavos?/i);
      let centavos = centsMatch ? centsMatch[1] : '00';
      if (centavos.length === 1) centavos += '0';
      return `${reais},${centavos}`;
    }

    let priceDe = '';
    let pricePor = '';

    // 1. Preços da Amazon
    const amazonPriceToPay = html.match(/class="[^"]*(?:apexPriceToPay|priceToPay)[^"]*"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i) ||
                             html.match(/class="a-price-whole">([0-9\.\,]+)<span class="a-price-decimal">[^<]*<\/span><span class="a-price-fraction">([0-9]+)</i);
    if (amazonPriceToPay) {
      if (amazonPriceToPay[2]) {
        pricePor = `${amazonPriceToPay[1].replace(/\./g, '')},${amazonPriceToPay[2]}`;
      } else {
        const clean = amazonPriceToPay[1].replace(/[^\d\,]/g, '');
        if (clean) pricePor = clean;
      }
    }

    const amazonPriceDe = html.match(/class="[^"]*(?:basisPrice|a-text-price)[^"]*"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i);
    if (amazonPriceDe && amazonPriceDe[1]) {
      const clean = amazonPriceDe[1].replace(/[^\d\,]/g, '');
      if (clean) priceDe = clean;
    }

    // 2. Preços do Mercado Livre (se não for Amazon)
    if (!pricePor) {
      const mainPriceMatch = html.match(/(?:class="[^"]*(?:poly-component__price|ui-pdp-price__main-container|ui-pdp-price)[^"]*"[^>]*>[\s\S]*?)(?:<\/div>\s*<\/div>|class="poly-component__installments"|class="ui-pdp-price__installments"|<form|<button)/i);
      const mainBlock = mainPriceMatch ? mainPriceMatch[0] : html;

      const antesAria = mainBlock.match(/aria-label=["']Antes:\s*([^"']+)["']/i);
      if (antesAria && antesAria[1]) {
        priceDe = parseAriaPrice(antesAria[1]);
      }

      const agoraAria = mainBlock.match(/aria-label=["']Agora:\s*([^"']+)["']/i);
      if (agoraAria && agoraAria[1]) {
        pricePor = parseAriaPrice(agoraAria[1]);
      }

      if (!pricePor) {
        const unicoAria = mainBlock.match(/aria-label=["']([0-9\.\,]+\s*reais?[^"']*)["']/i);
        if (unicoAria && unicoAria[1]) {
          pricePor = parseAriaPrice(unicoAria[1]);
        }
      }
    }

    // Se De e Por forem iguais, limpa o De
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
