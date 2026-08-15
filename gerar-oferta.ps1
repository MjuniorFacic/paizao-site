# ==============================================================================
# GERADOR DE OFERTAS - PAIZAO DOS DESCONTOS
# Automacao no formato "Achados de Tenis" para WhatsApp
# ==============================================================================

param (
    [string]$Url = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Yellow
Write-Host "   PAIZAO DOS DESCONTOS - GERADOR DE OFERTAS         " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Yellow
Write-Host ""

if ([string]::IsNullOrWhiteSpace($Url)) {
    $Url = Read-Host " Cole o link do produto / afiliado (ex: https://meli.la/32c6vC8)"
}

if ([string]::IsNullOrWhiteSpace($Url)) {
    Write-Host "Nenhum link informado. Encerrando." -ForegroundColor Red
    exit
}

Write-Host "`nAnalisando a oferta e buscando informacoes..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = Get-Location }
$fotosDir = Join-Path $scriptDir "fotos"
if (-not (Test-Path $fotosDir)) { New-Item -ItemType Directory -Path $fotosDir | Out-Null }
$jsonPath = Join-Path $scriptDir "p\ofertas.json"

# Headers simulando navegador moderno
$headers = @{
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    "Accept-Language" = "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
}

$html = ""

try {
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.UserAgent = $headers["User-Agent"]
    $req.AllowAutoRedirect = $true
    $req.Timeout = 15000
    
    $resp = $req.GetResponse()
    $stream = $resp.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    $html = $reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    $resp.Close()
} catch {
    try {
        $res = Invoke-WebRequest -Uri $Url -Headers $headers -TimeoutSec 15 -UseBasicParsing
        $html = $res.Content
    } catch {
        Write-Host "Erro ao acessar o link: $_" -ForegroundColor Red
    }
}

# 1. Extracao do Titulo
$titulo = ""
if ($html -match '<meta\s+property=["'']og:title["'']\s+content=["'']([^"'']+)["'']') {
    $titulo = $matches[1]
} elseif ($html -match '<meta\s+name=["'']title["'']\s+content=["'']([^"'']+)["'']') {
    $titulo = $matches[1]
} elseif ($html -match '<title[^>]*>([^<]+)</title>') {
    $titulo = $matches[1]
}

# Limpeza de sufixos comuns do ML
$titulo = $titulo -replace '\s*\|\s*MercadoLivre.*$', '' -replace '\s*\|\s*Mercado Livre.*$', '' -replace '\s*\|\s*Perfil Social.*$', ''
$titulo = $titulo.Trim()

if (-not $titulo) {
    $titulo = Read-Host " Digite o nome do produto"
}

# 2. Extracao da Imagem
$imgUrl = ""
if ($html -match '<meta\s+property=["'']og:image["'']\s+content=["'']([^"'']+)["'']') {
    $imgUrl = $matches[1]
} elseif ($html -match '<meta\s+name=["'']image["'']\s+content=["'']([^"'']+)["'']') {
    $imgUrl = $matches[1]
}

# 3. Extracao dos Precos
$precoDe = ""
$precoPor = ""

if ($html -match 'ui-pdp-price__original-value[\s\S]*?andes-money-amount__fraction["'']?>([0-9\.\,]+)<') {
    $precoDe = $matches[1]
} elseif ($html -match '"highPrice"\s*:\s*([0-9\.]+)') {
    $precoDe = $matches[1]
}

if ($html -match 'ui-pdp-price__second-line[\s\S]*?andes-money-amount__fraction["'']?>([0-9\.\,]+)<') {
    $precoPor = $matches[1]
} elseif ($html -match 'price-tag-fraction["'']?>([0-9\.\,]+)<') {
    $precoPor = $matches[1]
} elseif ($html -match '<meta\s+itemprop=["'']price["'']\s+content=["'']([^"'']+)["'']') {
    $precoPor = $matches[1]
} elseif ($html -match '"price"\s*:\s*([0-9\.]+)') {
    $precoPor = $matches[1]
}

Write-Host "`n Dados detectados da oferta:" -ForegroundColor Green
Write-Host "   Titulo:  $titulo" -ForegroundColor White
if ($precoDe) { Write-Host "   De:      R$ $precoDe" -ForegroundColor DarkGray }
if ($precoPor) { Write-Host "   Por:     R$ $precoPor" -ForegroundColor Green }
if ($imgUrl) { Write-Host "   Imagem:  $imgUrl" -ForegroundColor Cyan }

# Definicao da linha de preco
if ($precoDe -and $precoPor -and ($precoDe -ne $precoPor)) {
    $linhaPreco = "De R$ $precoDe por R$ $precoPor"
} elseif ($precoPor) {
    $linhaPreco = "Por R$ $precoPor"
} else {
    $linhaPreco = "De R$ 120 por R$ 59"
}

# 4. Headline baseada na categoria
$headline = "ECONOMIA E QUALIDADE PARA VOCE"
$tLower = $titulo.ToLower()

if ($tLower -match "lixeira|sensor|aspirador|limpeza|vapor|passar|ferro") {
    $headline = "PRATICIDADE E HIGIENE PARA SUA CASA"
} elseif ($tLower -match "tenis|calcado|sapato|nike|adidas|puma|corrida") {
    $headline = "CONFORTO E ESTILO PARA SEU DIA A DIA"
} elseif ($tLower -match "fone|airpod|headset|bluetooth|som|jbl") {
    $headline = "AUDIO DE ALTA QUALIDADE E POTENCIA"
} elseif ($tLower -match "fritadeira|air fryer|panel|cafeteir|liquidificador|cozinha") {
    $headline = "PRATICIDADE E VELOCIDADE NA COZINHA"
} elseif ($tLower -match "smartwatch|relogio|watch|pulseira") {
    $headline = "TECNOLOGIA E SAUDE NO SEU PULSO"
} elseif ($tLower -match "celular|smartphone|xiaomi|samsung|iphone|motorola") {
    $headline = "SUPER OFERTA EM SMARTPHONE"
}

# 5. Geracao de Slug sem acentos
$normalized = $titulo.Normalize([System.Text.NormalizationForm]::FormD)
$sb = New-Object System.Text.StringBuilder
foreach ($c in [char[]]$normalized) {
    $cat = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($c)
    if ($cat -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
        [void]$sb.Append($c)
    }
}
$slugClean = $sb.ToString().ToLower()
$slugClean = [System.Text.RegularExpressions.Regex]::Replace($slugClean, "[^a-z0-9\s-]", "")
$palavras = $slugClean.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries) | Select-Object -First 3
$slug = ($palavras -join "-")
if (-not $slug) { $slug = "oferta-" + (Get-Random -Minimum 100 -Maximum 999) }

$linkPaizao = "https://paizaodosdescontos.com.br/p/$slug"

# 6. Salvar em p/ofertas.json
try {
    $dadosJson = @{}
    if (Test-Path $jsonPath) {
        $jsonConteudo = Get-Content $jsonPath -Raw -Encoding UTF8
        if ($jsonConteudo) {
            $parsed = $jsonConteudo | ConvertFrom-Json
            if ($parsed) {
                foreach ($prop in $parsed.PSObject.Properties) {
                    $dadosJson[$prop.Name] = $prop.Value
                }
            }
        }
    }
    
    $dadosJson[$slug] = @{
        url = $Url
        titulo = $titulo
        preco = $linhaPreco
        loja = "Mercado Livre"
        criado_em = (Get-Date -Format "yyyy-MM-dd HH:mm")
    }
    
    $dadosJson | ConvertTo-Json -Depth 5 | Set-Content $jsonPath -Encoding UTF8
    Write-Host "`n[OK] Oferta cadastrada em p/ofertas.json com o codigo: '$slug'" -ForegroundColor Green
} catch {
    Write-Host "Aviso ao salvar JSON: $_" -ForegroundColor DarkYellow
}

# 7. Baixar Imagem Localmente
if ($imgUrl) {
    try {
        $imgExt = ".jpg"
        if ($imgUrl -match '\.(webp|png|jpg|jpeg)') { $imgExt = "." + $matches[1] }
        $imgDest = Join-Path $fotosDir "$slug$imgExt"
        Invoke-WebRequest -Uri $imgUrl -OutFile $imgDest -Headers $headers -TimeoutSec 10 -UseBasicParsing
        Write-Host "[OK] Foto salva em: fotos\$slug$imgExt" -ForegroundColor Cyan
    } catch {
        Write-Host "Imagem disponivel online: $imgUrl" -ForegroundColor DarkGray
    }
}

# 8. Montagem do Post WhatsApp (Formato Exato do Achados de Tenis)
$emojiMao = [char]::ConvertFromUtf32(0x1FAF5) + [char]::ConvertFromUtf32(0x1F3FD)
$postMsg = @"
$headline

$titulo

$linhaPreco

Pegar Promoção do Paizão
$linkPaizao

$emojiMao Participe do nosso grupo:
https://paizaodosdescontos.com.br/grupos
"@

# 9. Copiar para a Area de Transferencia
try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Clipboard]::SetText($postMsg)
    Write-Host "`n[COPIADO] Texto copiado para a Area de Transferencia!" -ForegroundColor Green
} catch {
    try { Set-Clipboard -Value $postMsg } catch {}
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Yellow
Write-Host "               POST PRONTO PARA O WHATSAPP           " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Yellow
Write-Host $postMsg -ForegroundColor White
Write-Host "=====================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Abra o WhatsApp Web, envie a foto da pasta 'fotos\' e cole (Ctrl+V) a legenda!" -ForegroundColor Green
Write-Host ""
