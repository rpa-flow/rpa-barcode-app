const preview = document.getElementById('preview');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const endpointInput = document.getElementById('endpointInput');
const lastCode = document.getElementById('lastCode');
const logOutput = document.getElementById('logOutput');

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

async function sendCode(code) {
  const endpoint = endpointInput.value.trim();
  if (!endpoint) {
    log('Endpoint vazio.');
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, scannedAt: new Date().toISOString() })
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
  detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'] });
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false
  });
  preview.srcObject = stream;
  scanning = true;
  log('Leitura via BarcodeDetector iniciada.');
  scanLoop();
}

async function startWithZXing() {
  if (!window.ZXingBrowser) {
    throw new Error('ZXing não carregou. Verifique sua conexão de internet.');
  }

  zxingReader = new window.ZXingBrowser.BrowserMultiFormatReader();
  const devices = await window.ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
  const backCamera = devices.find((d) => /back|rear|traseira|environment/i.test(d.label));
  const deviceId = backCamera?.deviceId || devices[0]?.deviceId;

  if (!deviceId) throw new Error('Nenhuma câmera encontrada.');

  zxingControls = await zxingReader.decodeFromVideoDevice(deviceId, preview, (result, error) => {
    if (result) onDetected(result.getText());
    if (error && error.name !== 'NotFoundException') {
      log(`Aviso ZXing: ${error.message}`);
    }
  });

  scanning = true;
  log('Leitura via ZXing iniciada (compatível com Android).');
}

async function startCamera() {
  try {
    startBtn.disabled = true;
    if ('BarcodeDetector' in window) {
      await startWithBarcodeDetector();
    } else {
      await startWithZXing();
    }
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

  if (zxingControls) {
    zxingControls.stop();
    zxingControls = null;
  }

  if (zxingReader?.reset) zxingReader.reset();

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
