const preview = document.getElementById('preview');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const sendBtn = document.getElementById('sendBtn');
const installBtn = document.getElementById('installBtn');
const nomeMotoristaInput = document.getElementById('nomeMotoristaInput');
const telefoneInput = document.getElementById('telefoneInput');
const placaInput = document.getElementById('placaInput');
const lastCode = document.getElementById('lastCode');
const statusOutput = document.getElementById('statusOutput');

let deferredInstallPrompt;
let stream;
let scanning = false;
let rafId;
let detector;
let zxingReader;
let zxingControls;
let currentCode = '';
let endpoint = '';

function setStatus(message) {
  statusOutput.textContent = message;
}

async function loadEndpointFromEnv() {
  try {
    const response = await fetch('/.env', { cache: 'no-store' });
    if (!response.ok) throw new Error('Arquivo .env não encontrado.');
    const text = await response.text();
    const postUrlLine = text.split('\n').find((line) => line.trim().startsWith('POST_URL='));
    if (!postUrlLine) throw new Error('POST_URL não definida no .env.');

    endpoint = postUrlLine.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
    if (!endpoint) throw new Error('POST_URL vazia no .env.');
  } catch (error) {
    setStatus(`Configuração inválida: ${error.message}`);
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').then(() => {
    setStatus('App pronto para uso.');
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
  setStatus('Aplicativo instalado com sucesso.');
});

async function sendCode() {
  if (!endpoint) return setStatus('Endpoint não configurado. Verifique o .env.');
  if (!currentCode) return setStatus('Leia um código antes de enviar.');

  const nomeMotorista = nomeMotoristaInput.value.trim();
  const telefone = telefoneInput.value.trim();
  const placa = placaInput.value.trim();

  try {
    sendBtn.disabled = true;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: currentCode,
        nomeMotorista,
        telefone,
        placa,
        scannedAt: new Date().toISOString()
      })
    });
    if (!response.ok) throw new Error(`Falha HTTP: ${response.status}`);
    setStatus('Dados enviados com sucesso.');
  } catch (error) {
    setStatus(`Erro ao enviar dados: ${error.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

function onDetected(code) {
  if (!code || code === currentCode) return;
  currentCode = code;
  lastCode.textContent = code;
  sendBtn.disabled = false;
  setStatus('Código lido. Toque em "Enviar dados".');
}

async function scanLoop() {
  if (!scanning || !detector) return;
  try {
    const barcodes = await detector.detect(preview);
    if (barcodes.length > 0) onDetected(barcodes[0].rawValue);
  } catch (error) {
    setStatus(`Erro na leitura: ${error.message}`);
  }
  rafId = requestAnimationFrame(scanLoop);
}

function explainCameraError(error) {
  const message = (error && error.message) || '';

  if (!window.isSecureContext) return 'A câmera só funciona em HTTPS ou localhost.';
  if (!navigator.mediaDevices?.getUserMedia) return 'Este navegador não suporta acesso à câmera.';
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'Permissão de câmera negada.';
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') return 'Nenhuma câmera encontrada.';
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') return 'A câmera está em uso por outro app.';

  return `Não foi possível iniciar a câmera: ${message || 'erro desconhecido.'}`;
}

async function startWithBarcodeDetector() {
  detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  preview.srcObject = stream;
  scanning = true;
  setStatus('Leitura iniciada. Aponte para o código de barras.');
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
  setStatus('Leitura iniciada. Aponte para o código de barras.');
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Este navegador não suporta acesso à câmera.');
    return;
  }

  try {
    startBtn.disabled = true;
    if ('BarcodeDetector' in window) await startWithBarcodeDetector();
    else await startWithZXing();
    stopBtn.disabled = false;
  } catch (error) {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    setStatus(explainCameraError(error));
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
  setStatus('Câmera parada.');
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
sendBtn.addEventListener('click', sendCode);

loadEndpointFromEnv();
