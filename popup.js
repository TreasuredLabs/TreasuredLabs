document.addEventListener('DOMContentLoaded', function() {
  let isLoggedIn = false;
  let loading = false;

  // Get DOM elements
  const loginView = document.getElementById('login-view');
  const scannerView = document.getElementById('scanner-view');
  const loginForm = document.getElementById('login-form');
  const loginButton = document.getElementById('login-button');
  const contractInput = document.getElementById('contract-input');
  const scanButton = document.getElementById('scan-button');
  const resultsSection = document.getElementById('analysis-results');
  const safetyCard = document.querySelector('.safety-card');
  const analysisCard = document.querySelector('.analysis-card');
  const alertsCard = document.querySelector('.alerts-card');

  // Reset entire scanner view state
  function resetScannerState() {
    // Hide all results
    resultsSection.classList.add('hidden');
    // Clear input
    contractInput.value = '';
    // Reset status
    updateStatusBadge('Ready to Scan', 'ready');
    // Clear previous analysis results
    if (safetyCard) safetyCard.querySelector('.safety-score').textContent = '--/100';
    if (analysisCard) {
      const tags = analysisCard.querySelectorAll('.tag');
      tags.forEach(tag => tag.textContent = '--');
    }
    if (alertsCard) {
      const alertItems = alertsCard.querySelector('.alert-items');
      if (alertItems) alertItems.innerHTML = '';
    }
  }

  // Check login status and reset scanner view
  chrome.storage.local.get('treasurex_logged_in', function(result) {
    if (result.treasurex_logged_in) {
      showScannerView();
      resetScannerState();
    }
  });

  // Handle login
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    loginButton.textContent = 'Connecting...';
    loginButton.disabled = true;

    await new Promise(resolve => setTimeout(resolve, 1500));
    chrome.storage.local.set({ treasurex_logged_in: true });
    showScannerView();
    resetScannerState();
  });

  function showScannerView() {
    loginView.classList.add('hidden');
    scannerView.classList.remove('hidden');
  }

  // Format contract address with ellipsis if too long
  contractInput.addEventListener('input', (e) => {
    const address = e.target.value;
    if (address.length > 24) {
      const formatted = address.slice(0, 12) + '...' + address.slice(-12);
      e.target.setAttribute('title', address);
      e.target.value = formatted;
    }
  });

  // Handle scan button click
  scanButton.addEventListener('click', async () => {
    const address = contractInput.getAttribute('title') || contractInput.value;
    if (!address || address.length < 32) {
      alert('Please enter a valid Solana contract address');
      return;
    }

    scanButton.disabled = true;
    scanButton.textContent = 'Scanning...';
    
    try {
      await scanContract(address);
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Scan failed. Please try again.');
    } finally {
      scanButton.disabled = false;
      scanButton.textContent = 'Scan Contract';
    }
  });

  // Reset state when popup closes
  window.addEventListener('unload', () => {
    chrome.storage.local.set({ 
      last_scan_timestamp: Date.now(),
      last_scan_address: null
    });
    resetScannerState();
  });

  async function scanContract(address) {
    // Show loading state
    updateStatusBadge('Scanning...', 'scanning');
    
    // Simulate API call delay
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockData = generateMockAnalysis(address);
        updateUI(mockData);
        resultsSection.classList.remove('hidden');
        resolve(mockData);
      }, 1500);
    });
  }

  function updateUI(data) {
    const { safetyScore, riskLevel, honeypotRisk, rugSafety, walletActivity } = data;
    
    // Update Safety Score and Status
    updateSafetyScore(safetyScore);
    updateStatusBadge(riskLevel === 'High' ? 'At Risk' : 'Protected', 
      riskLevel === 'High' ? 'danger' : 'protected');

    // Update Vault Analysis
    const analysisItems = document.querySelectorAll('.analysis-item');
    analysisItems.forEach((item, index) => {
      const tag = item.querySelector('.tag');
      if (tag) {
        switch(index) {
          case 0: // Honeypot Risk
            tag.textContent = honeypotRisk;
            tag.className = `tag ${honeypotRisk.toLowerCase()}`;
            break;
          case 1: // Rug Safety
            tag.textContent = rugSafety;
            tag.className = `tag ${rugSafety.toLowerCase()}`;
            break;
          case 2: // Fresh Wallet Activity
            const newTag = item.querySelector('.tag.new');
            const timeTag = item.querySelector('.tag.time');
            if (newTag && timeTag) {
              newTag.textContent = walletActivity.fresh;
              timeTag.textContent = '24h';
            }
            break;
          case 3: // Real Wallet Activity
            const percentTag = item.querySelector('.tag.percentage');
            const highTag = item.querySelector('.tag.high');
            if (percentTag && highTag) {
              percentTag.textContent = walletActivity.real;
              highTag.textContent = parseInt(walletActivity.real) > 70 ? 'High' : 'Low';
            }
            break;
        }
      }
    });

    // Update Alpha Alerts
    const alertsContainer = document.querySelector('.alert-items');
    if (alertsContainer) {
      alertsContainer.innerHTML = `
        <div class="alert-item">
          <div class="alert-dot green"></div>
          <div class="alert-content">
            <div class="alert-title">BONK</div>
            <div class="alert-subtitle">Potential 2x breakout forming</div>
          </div>
        </div>
        <div class="alert-item">
          <div class="alert-dot orange"></div>
          <div class="alert-content">
            <div class="alert-title">JUP</div>
            <div class="alert-subtitle">High volume spike detected</div>
          </div>
        </div>
        <div class="alert-item">
          <div class="alert-dot yellow"></div>
          <div class="alert-content">
            <div class="alert-title">PYTH</div>
            <div class="alert-subtitle">Accumulation zone reached</div>
          </div>
        </div>
      `;
    }
  }

  function updateStatusBadge(text, className) {
    const badge = document.querySelector('.status-badge');
    badge.textContent = text;
    badge.className = 'status-badge ' + className;
  }

  function updateSafetyScore(score) {
    const scoreElement = document.querySelector('.safety-score');
    if (scoreElement) {
      scoreElement.textContent = `${score}/100`;
      scoreElement.className = `safety-score ${parseInt(score) < 50 ? 'risk-high' : ''}`;
    }
  }

  function getRiskClass(value) {
    if (typeof value === 'string') {
      if (value.includes('High') || value.includes('Risk')) return 'risk';
      if (value.includes('Warning')) return 'warning';
      if (value.includes('Clean') || value.includes('Low')) return 'low';
    }
    return 'medium';
  }

  function generateMockAnalysis(address) {
    // Generate realistic-looking analysis based on address
    const riskLevel = Math.random() > 0.7 ? 'High' : 'Medium';
    const safetyScore = riskLevel === 'High' ? '45' : '92';

    return {
      safetyScore,
      riskLevel,
      honeypotRisk: riskLevel === 'High' ? 'High' : 'Low',
      rugSafety: riskLevel === 'High' ? 'Warning' : 'Clean',
      walletActivity: {
        fresh: '12 New',
        real: riskLevel === 'High' ? '45%' : '85%'
      },
      blockZero: riskLevel === 'High' ? 'Detected' : 'None',
      commonFunding: riskLevel === 'High' ? '8 Wallets' : '3 Wallets'
    };
  }
}); 