# ==============================================================================
# DOWNLOAD AUTOMÁTICO DE FOTOS HD DA SHOPEE - PAIZÃO DOS DESCONTOS
# Baixa todas as imagens da lista diretamente para D:\Users\Mauro\Pictures\PaizaoDosDescontos
# ==============================================================================

param (
    [string]$CsvPath = "",
    [string]$Destino = "D:\Users\Mauro\Pictures\PaizaoDosDescontos"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "================================================================" -ForegroundColor Yellow
Write-Host "   PAIZAO DOS DESCONTOS - DOWNLOAD EM LOTE DE FOTOS HD SHOPEE   " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Garante que a pasta de destino exista
if (-not (Test-Path $Destino)) {
    New-Item -ItemType Directory -Path $Destino -Force | Out-Null
    Write-Host "[+] Pasta de destino criada: $Destino" -ForegroundColor Green
} else {
    Write-Host "[*] Pasta de destino: $Destino" -ForegroundColor Green
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = Get-Location }

# 2. Localiza arquivo de dados (CSV ou shopee_produtos.json)
$itens = @()
$jsonPath = Join-Path $scriptDir "shopee_produtos.json"
$jsPath = Join-Path $scriptDir "shopee_produtos.js"

if ($CsvPath -and (Test-Path $CsvPath)) {
    Write-Host "[*] Lendo CSV informado: $CsvPath" -ForegroundColor Cyan
    $rows = Import-Csv -Path $CsvPath
    $idx = 1
    foreach ($r in $rows) {
        $itens += [PSCustomObject]@{
            index = $idx++
            itemId = $r.'Item Id'
            title = $r.'Item Name'
            offerUrl = $r.'Offer Link'
            productUrl = $r.'Product Link'
            price = $r.Price
            sales = $r.Sales
            shopName = $r.'Nome da loja'
            commissionRate = $r.'Commission Rate'
            commission = $r.Commission
            image = ""
        }
    }
} else {
    if (Test-Path $jsonPath) {
        Write-Host "[*] Lendo ofertas de: $jsonPath" -ForegroundColor Cyan
        $raw = Get-Content -Raw -Path $jsonPath -Encoding UTF8 | ConvertFrom-Json
        $idx = 1
        foreach ($it in $raw) {
            $itens += [PSCustomObject]@{
                index = $idx++
                itemId = $it.itemId
                title = $it.title
                offerUrl = $it.offerUrl
                productUrl = $it.productUrl
                price = $it.price
                sales = $it.sales
                shopName = $it.shopName
                commissionRate = $it.commissionRate
                commission = $it.commission
                image = $it.image
            }
        }
    }
}

if ($itens.Count -eq 0) {
    Write-Host "[-] Nenhuma oferta encontrada para baixar." -ForegroundColor Red
    exit
}

Write-Host "[*] Total de ofertas para processar: $($itens.Count)" -ForegroundColor Yellow
Write-Host ""

$total = $itens.Count
$sucessos = 0
$falhas = 0

function Limpar-NomeArquivo($nome) {
    $limpo = $nome -replace '[\\/:*?"<>|]', ''
    $limpo = $limpo.Trim()
    if ($limpo.Length -gt 50) {
        $limpo = $limpo.Substring(0, 50).Trim()
    }
    return $limpo
}

$novasImagensEncontradas = $false

for ($i = 0; $i -lt $itens.Count; $i++) {
    $item = $itens[$i]
    $num = "{0:D2}" -f $item.index
    $safeTitle = Limpar-NomeArquivo $item.title
    $fileName = "$num - $safeTitle.jpg"
    $destPath = Join-Path $Destino $fileName

    $subTitulo = $item.title
    if ($subTitulo.Length -gt 40) { $subTitulo = $subTitulo.Substring(0, 40) }

    Write-Host "[$($item.index)/$total] $num - $subTitulo..." -NoNewline

    # Se o arquivo já existe e tem tamanho > 10KB, não precisa baixar de novo
    if ((Test-Path $destPath) -and ((Get-Item $destPath).Length -gt 10240)) {
        Write-Host " [JA EXISTE]" -ForegroundColor DarkGray
        $sucessos++
        continue
    }

    $imgUrl = $item.image

    # Se não temos a URL da imagem HD, busca via shortlink/productUrl
    if (-not $imgUrl) {
        $urlBusca = $item.offerUrl
        if (-not $urlBusca) { $urlBusca = $item.productUrl }

        if ($urlBusca) {
            $rawHtml = curl.exe -s -A "WhatsApp/2.21.11.17" $urlBusca
            $html = $rawHtml -join "`n"
            if ($html -match 'property="og:image"\s+content="([^"]+)"') {
                $imgUrl = $matches[1]
                $item.image = $imgUrl
                $novasImagensEncontradas = $true
            }
        }
    }

    if ($imgUrl) {
        curl.exe -s $imgUrl -o $destPath
        if ((Test-Path $destPath) -and ((Get-Item $destPath).Length -gt 1024)) {
            Write-Host " [OK]" -ForegroundColor Green
            $sucessos++
        } else {
            Write-Host " [ERRO DOWNLOAD]" -ForegroundColor Red
            $falhas++
        }
    } else {
        Write-Host " [SEM FOTO]" -ForegroundColor DarkYellow
        $falhas++
    }
}

# Atualiza cache do json e js se novas imagens foram obtidas
if ($novasImagensEncontradas) {
    $cleanList = @()
    foreach ($it in $itens) {
        $cleanList += [PSCustomObject]@{
            itemId = $it.itemId
            title = $it.title
            price = $it.price
            sales = $it.sales
            shopName = $it.shopName
            commissionRate = $it.commissionRate
            commission = $it.commission
            productUrl = $it.productUrl
            offerUrl = $it.offerUrl
            image = $it.image
        }
    }
    $jsonContent = $cleanList | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($jsonPath, $jsonContent, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($jsPath, "window.SHOPEE_PRODUTOS_INICIAIS = $jsonContent;", [System.Text.Encoding]::UTF8)
    Write-Host "[*] shopee_produtos.json e .js atualizados com as imagens baixadas!" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Yellow
Write-Host " Concluido! Fotos prontas: $sucessos | Falhas: $falhas" -ForegroundColor Green
Write-Host " Pasta: $Destino" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Yellow

# Abre a pasta no Windows Explorer
Start-Process "explorer.exe" $Destino
