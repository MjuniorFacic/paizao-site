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

    // Procura valor riscado (preço De)
    const deMatch = html.match(/<s>.*?andes-money-amount__fraction[^>]*>([0-9\.\,]+)<\/span>/is) ||
                    html.match(/andes-money-amount--previous.*?andes-money-amount__fraction[^>]*>([0-9\.\,]+)<\/span>/is);
    const deCentsMatch = html.match(/<s>.*?andes-money-amount__cents[^>]*>([0-9]+)<\/span>/is) ||
                         html.match(/andes-money-amount--previous.*?andes-money-amount__cents[^>]*>([0-9]+)<\/span>/is);

    if (deMatch && deMatch[1]) {
      let pDe = deMatch[1].replace(/\./g, '');
      let cDe = deCentsMatch ? deCentsMatch[1] : '00';
      if (cDe.length === 1) cDe += '0';
      priceDe = `${pDe},${cDe}`;
    }

    // Procura valor com desconto ativo (preço Por)
    const porMatch = html.match(/andes-money-amount:not\(s\).*?andes-money-amount__fraction[^>]*>([0-9\.\,]+)<\/span>/is) ||
                     html.match(/andes-money-amount__fraction[^>]*>([0-9\.\,]+)<\/span>/i);
    const porCentsMatch = html.match(/andes-money-amount:not\(s\).*?andes-money-amount__cents[^>]*>([0-9]+)<\/span>/is) ||
                          html.match(/andes-money-amount__cents[^>]*>([0-9]+)<\/span>/i);

    if (porMatch && porMatch[1]) {
      let pPor = porMatch[1].replace(/\./g, '');
      let cPor = porCentsMatch ? porCentsMatch[1] : '00';
      if (cPor.length === 1) cPor += '0';
      pricePor = `${pPor},${cPor}`;
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
