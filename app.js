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
const readStatus = document.getElementById('readStatus');
const offlineWarning = document.getElementById('offlineWarning');
const historyList = document.getElementById('historyList');
const scannerTab = document.getElementById('scannerTab');
const historyTab = document.getElementById('historyTab');
const scannerTabBtn = document.getElementById('scannerTabBtn');
const historyTabBtn = document.getElementById('historyTabBtn');
const feedbackBanner = document.getElementById('feedbackBanner');

let deferredInstallPrompt;
let stream;
let scanning = false;
let rafId;
let detector;
let zxingReader;
let zxingControls;
let currentCode = '';
let endpoint = 'https://terminal-ops-web.vercel.app/api/ingest/records';

const API_KEY = '5f7a2c9e1b3d6f8a4c2e9d1f7b5a3c6e8d2f4b1a9c7e5d3f6a8b2c1e9d4f7a5c';
const FIXED_TERMINAL = 'TCS';
const FIXED_TEST_BARCODE = '31260342525894000183550010000428661000560748';

const QUEUE_KEY = 'pendingBarcodePayloads';
const WARNING_THRESHOLD = 100;
const HISTORY_KEY = 'barcodeSendHistory';
const HISTORY_LIMIT = 10;
let feedbackTimer;

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setStatus(message) {
  statusOutput.textContent = message;
}

function showFeedback(message, type = 'info') {
  if (!feedbackBanner) return;
  feedbackBanner.textContent = message;
  feedbackBanner.className = `feedback-banner ${type}`;
  feedbackBanner.hidden = false;

  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    feedbackBanner.hidden = true;
  }, 4200);
}

function applyFixedTestBarcode() {
  currentCode = FIXED_TEST_BARCODE;
  lastCode.textContent = FIXED_TEST_BARCODE;
  sendBtn.disabled = false;
  readStatus.textContent = 'Modo teste: código de barras fixo aplicado.';
}

function setSendLoading(isLoading) {
  const text = sendBtn.querySelector('.btn-text');
  const loader = sendBtn.querySelector('.btn-loader');
  sendBtn.disabled = isLoading;
  if (text) text.textContent = isLoading ? 'Enviando...' : 'Enviar dados';
  if (loader) loader.hidden = !isLoading;
}


function switchTab(tabName) {
  const showHistory = tabName === 'history';
  historyTab.hidden = !showHistory;
  scannerTab.hidden = showHistory;
  historyTabBtn.classList.toggle('active', showHistory);
  scannerTabBtn.classList.toggle('active', !showHistory);
}


function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  const safeHistory = Array.isArray(history) ? history.slice(0, HISTORY_LIMIT) : [];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(safeHistory));
}

function renderHistory() {
  const history = readHistory();
  if (history.length === 0) {
    historyList.innerHTML = '<p>Nenhum envio ainda.</p>';
    return;
  }

  historyList.innerHTML = history
    .map((item) => {
      const retryButton = item.status === 'falha' ? `<button data-retry-id="${item.id}" class="retry-btn">Tentar novamente</button>` : '';
      const errorText = item.error ? `<small>Erro: ${item.error}</small>` : '';
      return `
        <div class="history-item">
          <strong>${item.code || 'Sem código'}</strong>
          <span>${item.when} • ${item.status}</span>
          ${errorText}
          ${retryButton}
        </div>
      `;
    })
    .join('');
}

function addHistoryEntry(entry) {
  const history = readHistory();
  history.unshift(entry);
  writeHistory(history);
  renderHistory();
}

async function loadEndpointFromEnv() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Configuração do servidor indisponível.');

    const data = await response.json();
    endpoint = (data.postUrl || '').trim();
    if (!endpoint) throw new Error('POST_URL vazia no servidor.');
    return;
  } catch {
    // fallback local para ambiente de desenvolvimento sem Vercel
  }

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

function formatDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function readQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


function updateOfflineWarning(queueLength) {
  const shouldShowWarning = Number.isFinite(queueLength) && queueLength >= WARNING_THRESHOLD;
  offlineWarning.hidden = !shouldShowWarning;
}

function writeQueue(queue) {
  const safeQueue = Array.isArray(queue) ? queue : [];
  localStorage.setItem(QUEUE_KEY, JSON.stringify(safeQueue));
  updateOfflineWarning(safeQueue.length);
}

function queuePayload(payload) {
  const queue = readQueue();
  queue.push(payload);
  writeQueue(queue);
  if (queue.length >= WARNING_THRESHOLD) {
    setStatus(`Atenção: ${queue.length} notas pendentes. Vá para um local com internet e procure suporte.`);
  } else {
    setStatus(`Sem internet. ${queue.length} envio(s) salvo(s) para reenvio automático.`);
  }
}

async function postPayload(payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let responseDetails = '';
    try {
      const errorBody = await response.text();
      responseDetails = errorBody.trim();
    } catch {
      responseDetails = '';
    }

    const baseMessage = `Falha HTTP ${response.status} ${response.statusText || ''}`.trim();
    if (!responseDetails) throw new Error(baseMessage);
    throw new Error(`${baseMessage} - ${responseDetails.slice(0, 240)}`);
  }
}

async function flushQueue() {
  if (!endpoint || !navigator.onLine) return;

  const queue = readQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const payload of queue) {
    try {
      await postPayload(payload);
    } catch {
      remaining.push(payload);
    }
  }

  writeQueue(remaining);
  if (remaining.length === 0) setStatus('Envios pendentes reenviados com sucesso.');
  else if (remaining.length >= WARNING_THRESHOLD) setStatus(`Atenção: ${remaining.length} notas pendentes. Vá para um local com internet e procure suporte.`);
  else setStatus(`${remaining.length} envio(s) ainda pendente(s).`);
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
  if (!endpoint) {
    setStatus('Endpoint não configurado.');
    showFeedback('Endpoint não configurado.', 'error');
    return;
  }
  if (!currentCode) {
    setStatus('Leia um código antes de enviar.');
    showFeedback('Leia um código antes de enviar.', 'error');
    return;
  }

  const nomeMotorista = nomeMotoristaInput.value.trim();
  const telefone = telefoneInput.value.trim();
  const placa = placaInput.value.trim();

  const payload = {
    dataHora: formatDateTime(),
    nota: {
      numero: currentCode,
      original: currentCode,
      status: 'PROCESSADO'
    },
    motorista: {
      nome: nomeMotorista,
      celular: telefone
    },
    veiculo: {
      placa
    },
    terminal: FIXED_TERMINAL
  };

  try {
    setSendLoading(true);

    if (!navigator.onLine) {
      queuePayload(payload);
      addHistoryEntry({ id: createId(), code: currentCode, when: new Date().toLocaleString('pt-BR'), status: 'falha', error: 'Sem internet', payload });
      showFeedback('Sem internet. Dados salvos para reenvio.', 'warning');
      return;
    }

    await postPayload(payload);
    addHistoryEntry({ id: createId(), code: currentCode, when: new Date().toLocaleString('pt-BR'), status: 'enviado', payload });
    setStatus('Dados enviados com sucesso.');
    showFeedback('Dados enviados com sucesso.', 'success');
    await flushQueue();
  } catch (error) {
    queuePayload(payload);
    addHistoryEntry({ id: createId(), code: currentCode, when: new Date().toLocaleString('pt-BR'), status: 'falha', error: error.message, payload });
    setStatus(`Falha de rede. Dados salvos para reenvio automático. (${error.message})`);
    showFeedback(`Falha ao enviar: ${error.message}`, 'error');
  } finally {
    setSendLoading(false);
  }
}

function onDetected(code) {
  if (!code) return;
  currentCode = FIXED_TEST_BARCODE;
  lastCode.textContent = FIXED_TEST_BARCODE;
  sendBtn.disabled = false;
  stopCamera(false);
  readStatus.textContent = 'Leitura realizada com sucesso.';
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
  readStatus.textContent = 'Aguardando leitura...';
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

function stopCamera(showStatus = true) {
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
  if (showStatus) setStatus('Câmera parada.');
}


async function retryHistoryEntry(id) {
  const history = readHistory();
  const item = history.find((entry) => entry.id === id);
  if (!item || item.status !== 'falha') return;

  try {
    if (!navigator.onLine) throw new Error('Sem internet');
    await postPayload(item.payload);
    item.status = 'enviado';
    item.error = '';
    item.when = new Date().toLocaleString('pt-BR');
    writeHistory(history);
    renderHistory();
    setStatus('Reenvio manual concluído com sucesso.');
  } catch (error) {
    item.error = error.message;
    item.when = new Date().toLocaleString('pt-BR');
    writeHistory(history);
    renderHistory();
    setStatus(`Falha no reenvio manual: ${error.message}`);
  }
}

historyList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-retry-id]');
  if (!button) return;
  retryHistoryEntry(button.dataset.retryId);
});

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
sendBtn.addEventListener('click', sendCode);

scannerTabBtn.addEventListener('click', () => switchTab('scanner'));
historyTabBtn.addEventListener('click', () => switchTab('history'));

window.addEventListener('online', flushQueue);

const initialQueue = readQueue();
updateOfflineWarning(initialQueue.length);
writeQueue(initialQueue);
switchTab('scanner');
renderHistory();
applyFixedTestBarcode();
flushQueue();
