# rpa-barcode-app

Aplicativo simples para:

1. Abrir a câmera do dispositivo.
2. Ler código de barras.
3. Enviar o código lido por HTTP `POST` para um endpoint configurável.

## Compatibilidade Android

- **Primeira opção:** `BarcodeDetector` (quando disponível).
- **Fallback automático:** `ZXing` via CDN (funciona bem no Android).

## Como usar

```bash
python3 -m http.server 8080
```

Abra no celular Android em `http://SEU_IP_LOCAL:8080` (mesma rede Wi-Fi).

> Em Android, permita acesso à câmera no navegador.
