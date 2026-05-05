# rpa-barcode-app

Aplicativo de leitura de código de barras com câmera + POST HTTP.

## Instalar no Android como app (PWA)

1. Rode localmente:

```bash
python3 -m http.server 8080
```

2. Exponha com HTTPS (recomendado para instalação):

- Opção simples: `npx localtunnel --port 8080`
- Ou publique em Vercel/Netlify/GitHub Pages.

3. No Android (Chrome), abra a URL HTTPS e toque em **Instalar aplicativo**.

4. Depois de instalado, abra pelo ícone na tela inicial (sem precisar digitar IP).

## Observações

- Usa `BarcodeDetector` quando disponível.
- Usa fallback `ZXing` automaticamente no Android.
- O app registra `service-worker` para funcionamento como PWA.
