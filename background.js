chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    treasurex_logged_in: false,
    active_signals: [],
    settings: {
      alertVolume: 0.5,
      notifications: true,
      autoScan: true
    }
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SCAN_CONTRACT') {
    // Simulate contract scanning
    setTimeout(() => {
      sendResponse({
        success: true,
        data: {
          score: Math.floor(Math.random() * 30) + 70,
          risks: [],
          signals: [
            {
              type: 'BUY',
              confidence: 85,
              timestamp: Date.now()
            }
          ]
        }
      });
    }, 1000);
    return true;
  }
}); 