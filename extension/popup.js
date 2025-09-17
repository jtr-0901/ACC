// Popup functionality

class PopupManager {
  constructor() {
    this.baseCurrency = 'USD';
    this.currentHostname = '';
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.getCurrentTab();
    this.bindEvents();
    this.updateUI();
    this.performInitialConversion();
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['baseCurrency', 'enabledSites'], (result) => {
        this.baseCurrency = result.baseCurrency || 'USD';
        this.enabledSites = result.enabledSites || {};
        resolve();
      });
    });
  }

  async getCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const url = new URL(tabs[0].url);
        this.currentHostname = url.hostname;
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
      this.currentHostname = 'Unknown';
    }
  }

  updateUI() {
    // Update base currency info
    document.getElementById('baseCurrencyInfo').textContent = `Base: ${this.baseCurrency}`;
    
    // Update current site
    document.getElementById('currentSite').textContent = this.currentHostname;
    
    // Update conversion status
    const isEnabled = this.enabledSites[this.currentHostname] !== false;
    document.getElementById('conversionStatus').textContent = isEnabled ? 'Enabled' : 'Disabled';
    document.getElementById('conversionStatus').style.color = isEnabled ? '#28a745' : '#dc3545';
    
    // Update toggle button text
    document.getElementById('toggleSite').textContent = isEnabled ? 'Disable Site' : 'Enable Site';
    
    // Update last updated time
    this.updateLastUpdatedTime();
  }

  async updateLastUpdatedTime() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get([`rates_${this.baseCurrency}`], resolve);
      });
      
      const rateData = result[`rates_${this.baseCurrency}`];
      if (rateData && rateData.timestamp) {
        const lastUpdated = new Date(rateData.timestamp);
        const now = new Date();
        const diffMs = now - lastUpdated;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeText;
        if (diffHours > 0) {
          timeText = `${diffHours}h ${diffMins}m ago`;
        } else if (diffMins > 0) {
          timeText = `${diffMins}m ago`;
        } else {
          timeText = 'Just now';
        }
        
        document.getElementById('lastUpdated').textContent = timeText;
      } else {
        document.getElementById('lastUpdated').textContent = 'Never';
      }
    } catch (error) {
      console.error('Error updating last updated time:', error);
      document.getElementById('lastUpdated').textContent = 'Unknown';
    }
  }

  bindEvents() {
    // Amount and currency change events
    document.getElementById('amount').addEventListener('input', () => {
      this.performConversion();
    });

    document.getElementById('fromCurrency').addEventListener('change', () => {
      this.performConversion();
    });

    // Toggle site button
    document.getElementById('toggleSite').addEventListener('click', () => {
      this.toggleCurrentSite();
    });

    // Settings button
    document.getElementById('openOptions').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });

    // Refresh rates button
    document.getElementById('refreshRates').addEventListener('click', () => {
      this.refreshExchangeRates();
    });
  }

  performInitialConversion() {
    // Set default amount and perform conversion
    setTimeout(() => {
      this.performConversion();
    }, 500);
  }

  async performConversion() {
    const amount = parseFloat(document.getElementById('amount').value);
    const fromCurrency = document.getElementById('fromCurrency').value;
    
    if (isNaN(amount) || amount <= 0) {
      document.getElementById('conversionResult').innerHTML = '<div class="loading">Enter valid amount</div>';
      return;
    }

    if (fromCurrency === this.baseCurrency) {
      const formatted = this.formatCurrency(amount, this.baseCurrency);
      document.getElementById('conversionResult').textContent = formatted;
      return;
    }

    document.getElementById('conversionResult').innerHTML = '<div class="loading">Converting...</div>';
    document.getElementById('conversionError').style.display = 'none';

    try {
      const convertedAmount = await this.convertCurrency(amount, fromCurrency, this.baseCurrency);
      const formatted = this.formatCurrency(convertedAmount, this.baseCurrency);
      document.getElementById('conversionResult').textContent = formatted;
    } catch (error) {
      console.error('Conversion error:', error);
      document.getElementById('conversionResult').innerHTML = '<div class="loading">Conversion failed</div>';
      document.getElementById('conversionError').textContent = error.message;
      document.getElementById('conversionError').style.display = 'block';
    }
  }

  async convertCurrency(amount, fromCurrency, toCurrency) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'convertCurrency',
        data: { amount, fromCurrency, toCurrency }
      }, (response) => {
        if (response && response.success) {
          resolve(response.convertedAmount);
        } else {
          reject(new Error(response ? response.error : 'Failed to convert currency'));
        }
      });
    });
  }

  formatCurrency(amount, currencyCode) {
    const symbols = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$',
      AUD: 'AU$', CHF: 'CHF', CNY: '¥', INR: '₹', KRW: '₩'
    };

    const symbol = symbols[currencyCode] || currencyCode;
    const roundedAmount = Math.round(amount * 100) / 100;
    
    if (currencyCode === 'JPY' || currencyCode === 'KRW') {
      return `${symbol}${Math.round(amount).toLocaleString()}`;
    }
    
    return `${symbol}${roundedAmount.toFixed(2)}`;
  }

  async toggleCurrentSite() {
    try {
      const isEnabled = this.enabledSites[this.currentHostname] !== false;
      this.enabledSites[this.currentHostname] = !isEnabled;
      
      await new Promise((resolve) => {
        chrome.storage.sync.set({ enabledSites: this.enabledSites }, resolve);
      });
      
      this.updateUI();
      
      // Reload the current tab to apply changes
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
      
    } catch (error) {
      console.error('Error toggling site:', error);
    }
  }

  async refreshExchangeRates() {
    const refreshButton = document.getElementById('refreshRates');
    const originalText = refreshButton.textContent;
    
    refreshButton.textContent = 'Refreshing...';
    refreshButton.disabled = true;
    
    try {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'getExchangeRates',
          data: { baseCurrency: this.baseCurrency }
        }, (response) => {
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response ? response.error : 'Failed to refresh rates'));
          }
        });
      });
      
      this.updateLastUpdatedTime();
      this.performConversion();
      
    } catch (error) {
      console.error('Error refreshing rates:', error);
    } finally {
      refreshButton.textContent = originalText;
      refreshButton.disabled = false;
    }
  }
}

// Initialize popup manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});