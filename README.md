# rpa-barcode-app

Aplicativo de leitura de código de barras com câmera + POST HTTP.

## Rodando localmente (desktop)

1. Inicie um servidor HTTP na pasta do projeto:

```bash
python3 -m http.server 8080
```

2. Abra no navegador:

```text
http://localhost:8080
```

## Rodando no Android

### Opção A (teste rápido na mesma rede)

1. Com o servidor rodando no computador, descubra seu IP local (ex.: `192.168.0.25`).
2. No Android, na mesma rede Wi‑Fi, abra:

```text
http://192.168.0.25:8080
```

> Para câmera funcionar, conceda permissão quando o navegador pedir.

### Opção B (instalar como app PWA)

1. Publique o app com **HTTPS** (Vercel, Netlify, GitHub Pages etc.).
2. Abra a URL HTTPS no Chrome Android.
3. Toque em **Instalar aplicativo** (ou menu do Chrome > Instalar app).
4. O app ficará na tela inicial e abrirá em modo standalone.

---

## Como gerar APK (Android)

A forma recomendada é usar **TWA (Trusted Web Activity)** com `bubblewrap`, empacotando a versão publicada em HTTPS.

### Pré-requisitos

- Node.js 18+
- JDK 17+
- Android SDK (com `adb` e `build-tools`)
- App já publicado em HTTPS (ex.: `https://seu-app.com`)

### 1) Instalar Bubblewrap

```bash
npm i -g @bubblewrap/cli
```

### 2) Inicializar projeto Android

```bash
bubblewrap init --manifest https://seu-app.com/manifest.webmanifest
```

> Preencha `applicationId` (ex.: `com.suaempresa.barcodeapp`), nome do app e configuração de assinatura.

### 3) Gerar APK

```bash
bubblewrap build
```

O APK será gerado na pasta `app/build/outputs/apk/`.

### 4) Instalar APK no dispositivo (opcional)

```bash
adb install app/build/outputs/apk/release/app-release-signed.apk
```

---

## Observações técnicas

- Usa `BarcodeDetector` quando disponível.
- Usa fallback `ZXing` automaticamente no Android.
- Registra `service-worker` para experiência PWA instalável.


## Configuração do endpoint (obrigatório)

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

2. Edite o `.env` e informe a URL da API:

```text
POST_URL=https://seu-endpoint.com/api/barcode
```

> A URL de envio não aparece mais na tela do app para simplificar o uso para usuário final.
> O envio é feito ao tocar no botão **Enviar dados** após a leitura do código.


## Funcionamento offline (sem internet)

Se o aparelho ficar sem internet no momento do envio:

- O app salva os dados localmente no navegador (fila local).
- Quando a internet voltar, o app tenta reenviar automaticamente os itens pendentes.
- Você também pode continuar lendo códigos normalmente enquanto estiver offline.


## Publicação no Vercel

1. Crie um projeto no Vercel apontando para este repositório.
2. Em **Settings > Environment Variables**, crie a variável:

```text
POST_URL=https://seu-endpoint.com/api/barcode
```

3. Faça o deploy. O app ficará em HTTPS automaticamente (necessário para câmera e instalação PWA).
4. Abra a URL no Android e use **Instalar aplicativo** para adicionar na tela inicial.

> Em ambiente local, o app ainda aceita fallback via arquivo `.env`.
