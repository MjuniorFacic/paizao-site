import ofertasLocais from '../p/ofertas.json' assert { type: 'json' };

export default async function handler(req, res) {
  const { id, codigo } = req.query;
  const slug = (id || codigo || '').trim().toLowerCase();

  if (!slug) {
    return res.redirect(307, '/grupos/');
  }

  let destino = null;

  // 1. Tenta direto do ofertas.json embutido no servidor (0ms)
  if (ofertasLocais && ofertasLocais[slug]) {
    const o = ofertasLocais[slug];
    destino = (typeof o === 'string') ? o : (o.url || null);
  }

  // 2. Se for uma oferta recém-criada, consulta GitHub Raw em tempo real
  if (!destino) {
    try {
      const resGh = await fetch(`https://raw.githubusercontent.com/MjuniorFacic/paizao-site/main/p/ofertas.json?t=${Date.now()}`, { cache: 'no-store' });
      if (resGh.ok) {
        const ofertasGh = await resGh.json();
        if (ofertasGh && ofertasGh[slug]) {
          const oGh = ofertasGh[slug];
          destino = (typeof oGh === 'string') ? oGh : (oGh.url || null);
        }
      }
    } catch(e) {}
  }

  // 3. Fallback final direto da API do GitHub
  if (!destino) {
    try {
      const resApi = await fetch(`https://api.github.com/repos/MjuniorFacic/paizao-site/contents/p/ofertas.json?t=${Date.now()}`);
      if (resApi.ok) {
        const dataApi = await resApi.json();
        const decoded = decodeURIComponent(atob(dataApi.content.replace(/\s/g, '')).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const ofertasApi = JSON.parse(decoded);
        if (ofertasApi && ofertasApi[slug]) {
          const oApi = ofertasApi[slug];
          destino = (typeof oApi === 'string') ? oApi : (oApi.url || null);
        }
      }
    } catch(e) {}
  }

  // Se encontrou o link, redireciona a nível de servidor HTTP (0.01s - Instantâneo!)
  if (destino) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return res.redirect(307, destino);
  }

  // Se a oferta realmente não existe, manda pra página de aviso
  return res.redirect(307, `/p/index.html?id=${encodeURIComponent(slug)}`);
}
