$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$rootPrefix = $root.TrimEnd('\') + '\'
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://127.0.0.1:8080/')

Write-Output 'Iniciando servidor local'
$listener.Start()
Write-Output 'Servidor disponible en http://127.0.0.1:8080'

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response

    try {
        $relativePath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            $relativePath = 'index.html'
        }

        $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
        if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
            $response.StatusCode = 404
            $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
            $response.OutputStream.Write($body, 0, $body.Length)
            continue
        }

        $contentType = switch ([System.IO.Path]::GetExtension($filePath).ToLowerInvariant()) {
            '.html' { 'text/html; charset=utf-8' }
            '.css'  { 'text/css; charset=utf-8' }
            '.js'   { 'application/javascript; charset=utf-8' }
            default { 'application/octet-stream' }
        }

        $response.ContentType = $contentType
        $body = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $body.Length
        $response.OutputStream.Write($body, 0, $body.Length)
    }
    finally {
        $response.Close()
    }
}
