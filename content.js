// Inject TreasureX UI
function injectTreasureXUI() {
  const container = document.createElement('div');
  container.id = 'treasurex-container';
  container.innerHTML = `
    <div class="tx-overlay">
      <div class="tx-header">
        <div class="tx-logo">TreasureX</div>
        <div class="tx-status">SCANNING</div>
      </div>
      
      <div class="tx-content">
        <div class="tx-score">
          <div class="tx-score-label">Security Score</div>
          <div class="tx-score-value">--</div>
        </div>
        
        <div class="tx-signals">
          <div class="tx-signals-header">Alpha Signals</div>
          <div class="tx-signals-list"></div>
        </div>
      </div>
      
      <div class="tx-actions">
        <button class="tx-button tx-buy">Quick Buy</button>
        <button class="tx-button tx-sell">Quick Sell</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);
  initializeOverlay();
}

function initializeOverlay() {
  // Get contract address from URL or page
  const contractAddress = getContractAddress();
  if (!contractAddress) return;
  
  // Request contract scan
  chrome.runtime.sendMessage(
    { type: 'SCAN_CONTRACT', address: contractAddress },
    response => {
      if (response.success) {
        updateUI(response.data);
      }
    }
  );
}

function updateUI(data) {
  const scoreEl = document.querySelector('.tx-score-value');
  const signalsEl = document.querySelector('.tx-signals-list');
  const statusEl = document.querySelector('.tx-status');
  
  scoreEl.textContent = data.score;
  statusEl.textContent = 'PROTECTED';
  statusEl.classList.add('tx-status-protected');
  
  data.signals.forEach(signal => {
    const signalEl = document.createElement('div');
    signalEl.className = `tx-signal tx-signal-${signal.type.toLowerCase()}`;
    signalEl.innerHTML = `
      <div class="tx-signal-type">${signal.type}</div>
      <div class="tx-signal-confidence">${signal.confidence}%</div>
    `;
    signalsEl.appendChild(signalEl);
  });
}

// Initialize on page load
if (document.readyState === 'complete') {
  injectTreasureXUI();
} else {
  window.addEventListener('load', injectTreasureXUI);
} 