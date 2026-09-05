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

    // Se for link da Shopee (shortlink s.shopee.com.br, shope.ee ou produto)
    const isShopee = finalUrl.includes('shopee.com.br') || finalUrl.includes('shope.ee') || finalUrl.includes('s.shopee.com.br');
    if (isShopee) {
      // 1. Resolve redirect de link curto caso necessário
      if (finalUrl.includes('s.shopee.com.br') || finalUrl.includes('shope.ee')) {
        try {
          const resShort = await fetch(finalUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            },
            redirect: 'manual'
          });
          const loc = resShort.headers.get('location');
          if (loc) finalUrl = loc;
        } catch (e) {}
      }

      // 2. Extrai shopId e itemId para montar a URL canônica do produto
      const shopeeIdMatch = finalUrl.match(/(?:opaanlp\/|product\/|.+?-i\.)(\d+)[\/\.](\d+)/i) ||
                            finalUrl.match(/itemid=(\d+).*?shopid=(\d+)/i);
      if (shopeeIdMatch) {
        let shopId, itemId;
        if (finalUrl.includes('itemid=')) {
          itemId = shopeeIdMatch[1];
          shopId = shopeeIdMatch[2];
        } else {
          shopId = shopeeIdMatch[1];
          itemId = shopeeIdMatch[2];
        }
        finalUrl = `https://shopee.com.br/product/${shopId}/${itemId}`;
      }

      // 3. Efetua fetch com User-Agent de crawler social para receber OpenGraph sem bloqueio
      const shopeeResponse = await fetch(finalUrl, {
        headers: {
          'User-Agent': 'WhatsApp/2.21.11.17',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        redirect: 'follow'
      });

      if (shopeeResponse.ok) {
        html = await shopeeResponse.text();
      }
    }

    // Se for link curto da Amazon (amzn.to ou a.co)
    if (finalUrl.includes('amzn.to') || finalUrl.includes('a.co')) {
      try {
        const resShort = await fetch(finalUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
          },
          redirect: 'manual'
        });
        const loc = resShort.headers.get('location');
        if (loc) finalUrl = loc;
      } catch (e) {}
    }

    if (!html) {
      const isAmazon = finalUrl.includes('amazon.');
      const headers = isAmazon ? {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': 'lc-acbbr=pt_BR; i18n-prefs=BRL; sp-cdn="L5Z9:BR"',
        'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      } : {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      };

      const response = await fetch(finalUrl, {
        headers,
        redirect: 'follow'
      });
      html = await response.text();
    }

    // Extração de Título
    let title = '';
    const isErrorTitle = (t) => !t || t.includes('Não é possível') || t.includes('Acesso negado') || t.includes('503 - Erro') || t.includes('Não foi possível encontrar');

    const amazonTitle = html.match(/id=["']productTitle["'][^>]*>([^<]+)<\/span>/i);
    if (amazonTitle && amazonTitle[1] && !isErrorTitle(amazonTitle[1])) {
      title = amazonTitle[1].trim();
    } else {
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogTitle && ogTitle[1] && !isErrorTitle(ogTitle[1])) {
        title = ogTitle[1];
      } else {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1] && !isErrorTitle(titleMatch[1])) {
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

    // Limpa sufixos de marca no título
    if (title) {
      title = title.replace(/\s*\|\s*MercadoLivre.*$/i, '')
                   .replace(/\s*\|\s*Mercado Livre.*$/i, '')
                   .replace(/\s*\|\s*Magazine Luiza.*$/i, '')
                   .replace(/^Magazine Luiza\s*\|\s*/i, '')
                   .replace(/\s*:\s*Amazon\.com\.br.*$/i, '')
                   .replace(/\s*\|\s*Amazon\.com\.br.*$/i, '')
                   .replace(/\s*\|\s*Shopee\s*Brasil.*$/i, '')
                   .trim();
    }

    // Extração de Imagem (com suporte a alta definição Shopee, Amazon e ML)
    let image = '';
    if (finalUrl.includes('shopee.') || html.includes('susercontent.com')) {
      const shopeeImg = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
                        html.match(/https:\/\/(?:down-br|down-cvs-br|cf)\.img\.susercontent\.com\/file\/[a-zA-Z0-9_-]+/i);
      if (shopeeImg) {
        image = shopeeImg[1] || shopeeImg[0];
      }
    }

    if (!image) {
      const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogImage && ogImage[1]) {
        image = ogImage[1];
      }
    }

    // Se for Amazon, tenta a imagem em alta resolução (data-old-hires ou landingImage)
    if (finalUrl.includes('amazon.')) {
      const amazonImg = html.match(/data-old-hires=["'](https:\/\/[^"']+)["']/i) ||
                        html.match(/id=["']landingImage["'][^>]*data-a-dynamic-image=["']\{&quot;(https:\/\/[^&]+)&quot;/i) ||
                        html.match(/"hiRes":\s*"(https:\/\/[^"]+)"/i) ||
                        html.match(/"large":\s*"(https:\/\/[^"]+)"/i) ||
                        html.match(/id=["']landingImage["'][^>]*src=["'](https:\/\/[^"']+)["']/i);
      if (amazonImg) {
        image = amazonImg[1] || amazonImg[2] || amazonImg[3] || amazonImg[4] || amazonImg[5] || '';
      }
    }

    // Rejeita placeholders conhecidos de erro/bloqueio
    if (image && (image.includes('deo.shopeemobile.com') || image.includes('placeholder'))) {
      image = '';
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
    const amazonPriceToPay = html.match(/class="[^"]*(?:apex-?price-?to-?pay|price-?to-?pay|corePriceDisplay)[^"]*"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i) ||
                             html.match(/class="[^"]*apex-core-price-identifier[^"]*"[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i) ||
                             html.match(/id="corePriceDisplay_desktop_feature_div"[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i) ||
                             html.match(/class="a-price-whole">([0-9\.\,]+)(?:<span class="a-price-decimal">[^<]*<\/span>)?<\/span><span class="a-price-fraction">([0-9]+)</i) ||
                             html.match(/class="a-price-whole">([0-9\.\,]+)<span class="a-price-decimal">[^<]*<\/span><span class="a-price-fraction">([0-9]+)</i) ||
                             html.match(/class="a-price\b[^"]*"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i) ||
                             html.match(/id="(?:priceblock_ourprice|priceblock_dealprice|price_inside_buybox)"[^>]*>([^<]+)<\/span>/i) ||
                             html.match(/"priceAmount":\s*([0-9\.]+)/i);

    if (amazonPriceToPay) {
      if (amazonPriceToPay[2]) {
        pricePor = `${amazonPriceToPay[1].replace(/\./g, '')},${amazonPriceToPay[2]}`;
      } else {
        const clean = amazonPriceToPay[1].replace(/&nbsp;/g, ' ').replace(/[^\d\,]/g, '');
        if (clean) pricePor = clean;
      }
    }

    const amazonPriceDe = html.match(/class="[^"]*(?:basis-?price|a-text-price|apex-basisprice)[^"]*"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i) ||
                          html.match(/class="[^"]*apex-basisprice-offscreen-label[^"]*">[^:]*:\s*([^<]+)<\/span>/i) ||
                          html.match(/data-a-strike="true"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i) ||
                          html.match(/class="a-text-strike"[^>]*>([\s\S]*?)<\/span>/i);

    if (amazonPriceDe && amazonPriceDe[1]) {
      const clean = amazonPriceDe[1].replace(/&nbsp;/g, ' ').replace(/[^\d\,]/g, '');
      if (clean) priceDe = clean;
    }

    // Fallback de Preço Amazon: caso os seletores principais não tenham retornado por variação de layout
    if (!pricePor && (finalUrl.includes('amazon.') || finalUrl.includes('amzn.to') || finalUrl.includes('a.co'))) {
      const centerColMatch = html.match(/id="(?:centerCol|dp-container|desktop_buybox)"[\s\S]*?(?:id="desktop_buybox"|id="productDetails_feature_div"|<\/body)/i);
      const searchHtml = centerColMatch ? centerColMatch[0] : html;

      const anyPriceMatch = searchHtml.match(/class="[^"]*(?:a-price|a-color-price)[^"]*"[^>]*>[\s\S]*?<span class="a-offscreen">\s*(?:R\$\s*)?([0-9\.\,]+)\s*<\/span>/i) ||
                            searchHtml.match(/<span class="a-offscreen">\s*(?:R\$\s*)?([0-9\.\,]+)\s*<\/span>/i) ||
                            searchHtml.match(/(?:R\$\s*|BRL\s*)([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i);
      if (anyPriceMatch && anyPriceMatch[1]) {
        pricePor = anyPriceMatch[1].replace(/&nbsp;/g, ' ').replace(/[^\d\,]/g, '');
      }
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

    if (req.query.debug) {
      const rMatches = (html.match(/R\$\s*[\d\.\,]+/gi) || []).slice(0, 15);
      const offscreenMatches = (html.match(/<span class="a-offscreen">([^<]+)<\/span>/gi) || []).slice(0, 10);
      const ldJsonMatches = (html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || []).slice(0, 3);
      return res.status(200).json({
        status: 'debug',
        data: {
          title,
          image,
          priceDe,
          pricePor,
          finalUrl,
          htmlLength: html.length,
          hasPriceWhole: html.includes('a-price-whole'),
          hasOffscreen: html.includes('a-offscreen'),
          hasApexPrice: html.includes('apex'),
          hasCenterCol: html.includes('centerCol'),
          rMatches,
          offscreenMatches,
          ldJsonMatches
        }
      });
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
