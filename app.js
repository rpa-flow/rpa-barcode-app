const preview = document.getElementById('preview');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const installBtn = document.getElementById('installBtn');
const endpointInput = document.getElementById('endpointInput');
const nomeMotoristaInput = document.getElementById('nomeMotoristaInput');
const telefoneInput = document.getElementById('telefoneInput');
const placaInput = document.getElementById('placaInput');
const lastCode = document.getElementById('lastCode');
const logOutput = document.getElementById('logOutput');

let deferredInstallPrompt;
let stream;
let scanning = false;
let rafId;
let lastSentCode = '';
let detector;
let zxingReader;
let zxingControls;

function log(message) {
  const now = new Date().toLocaleTimeString('pt-BR');
  logOutput.textContent = `[${now}] ${message}\n` + logOutput.textContent;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').then(() => {
    log('Service worker ativo. App pode ser instalado.');
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener('appinstalled', () => {
  installBtn.hidden = true;
  log('Aplicativo instalado com sucesso.');
});

async function sendCode(code) {
  const endpoint = endpointInput.value.trim();
  if (!endpoint) return log('Endpoint vazio.');

  const nomeMotorista = nomeMotoristaInput.value.trim();
  const telefone = telefoneInput.value.trim();
  const placa = placaInput.value.trim();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        nomeMotorista,
        telefone,
        placa,
        scannedAt: new Date().toISOString()
      })
    });
    if (!response.ok) throw new Error(`Falha HTTP: ${response.status}`);
    log(`Código enviado com sucesso: ${code}`);
  } catch (error) {
    log(`Erro ao enviar código: ${error.message}`);
  }
}

function onDetected(code) {
  if (!code || code === lastSentCode) return;
  lastSentCode = code;
  lastCode.textContent = code;
  log(`Código detectado: ${code}`);
  sendCode(code);
}

async function scanLoop() {
  if (!scanning || !detector) return;
  try {
    const barcodes = await detector.detect(preview);
    if (barcodes.length > 0) onDetected(barcodes[0].rawValue);
  } catch (error) {
    log(`Erro na leitura: ${error.message}`);
  }
  rafId = requestAnimationFrame(scanLoop);
}

async function startWithBarcodeDetector() {
  detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  preview.srcObject = stream;
  scanning = true;
  log('Leitura via BarcodeDetector iniciada.');
  scanLoop();
}

async function startWithZXing() {
  if (!window.ZXingBrowser) throw new Error('ZXing não carregou.');
  zxingReader = new window.ZXingBrowser.BrowserMultiFormatReader();
  const devices = await window.ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
  const backCamera = devices.find((d) => /back|rear|traseira|environment/i.test(d.label));
  const deviceId = backCamera?.deviceId || devices[0]?.deviceId;
  if (!deviceId) throw new Error('Nenhuma câmera encontrada.');

  zxingControls = await zxingReader.decodeFromVideoDevice(deviceId, preview, (result) => {
    if (result) onDetected(result.getText());
  });

  scanning = true;
  log('Leitura via ZXing iniciada (compatível com Android).');
}

async function startCamera() {
  try {
    startBtn.disabled = true;
    if ('BarcodeDetector' in window) await startWithBarcodeDetector();
    else await startWithZXing();
    stopBtn.disabled = false;
  } catch (error) {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    log(`Não foi possível iniciar leitura: ${error.message}`);
  }
}

function stopCamera() {
  scanning = false;
  cancelAnimationFrame(rafId);
  if (zxingControls) zxingControls.stop();
  if (zxingReader?.reset) zxingReader.reset();
  zxingControls = null;

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  preview.srcObject = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  log('Câmera parada.');
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
