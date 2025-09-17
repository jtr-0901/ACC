// Options page functionality

class OptionsManager {
  constructor() {
    this.defaultSettings = {
      baseCurrency: 'USD',
      apiKey: '',
      enabledSites: {},
      showOriginalOnHover: true,
      animateConversions: true,
      updateFrequency: 'daily'
    };
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.bindEvents();
    await this.getCurrentTab();
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(Object.keys(this.defaultSettings), (result) => {
        this.settings = { ...this.defaultSettings, ...result };
        this.populateForm();
        resolve();
      });
    });
  }

  populateForm() {
    // Base currency
    document.getElementById('baseCurrency').value = this.settings.baseCurrency;
    
    // API key
    document.getElementById('apiKey').value = this.settings.apiKey;
    
    // Advanced settings
    document.getElementById('showOriginalOnHover').checked = this.settings.showOriginalOnHover;
    document.getElementById('animateConversions').checked = this.settings.animateConversions;
    document.getElementById('updateFrequency').value = this.settings.updateFrequency;
    
    // Update disabled sites list
    this.updateDisabledSitesList();
  }

  async getCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;
        
        document.getElementById('currentSiteUrl').textContent = hostname;
        document.getElementById('enableCurrentSite').checked = 
          this.settings.enabledSites[hostname] !== false;
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
      document.getElementById('currentSiteUrl').textContent = 'Unable to detect';
    }
  }

  updateDisabledSitesList() {
    const container = document.getElementById('disabledSites');
    container.innerHTML = '';
    
    const disabledSites = Object.entries(this.settings.enabledSites)
      .filter(([, enabled]) => enabled === false)
      .map(([site]) => site);
    
    if (disabledSites.length === 0) {
      container.innerHTML = '<p style="color: #666; text-align: center; margin: 10px;">No disabled sites</p>';
      return;
    }
    
    disabledSites.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      siteItem.innerHTML = `
        <span>${site}</span>
        <button onclick="optionsManager.enableSite('${site}')" style="background: #28a745; padding: 4px 8px; font-size: 12px;">
          Enable
        </button>
      `;
      container.appendChild(siteItem);
    });
  }

  enableSite(hostname) {
    this.settings.enabledSites[hostname] = true;
    this.updateDisabledSitesList();
    this.showStatus('Site enabled successfully!', 'success');
  }

  bindEvents() {
    // Save button
    document.getElementById('saveOptions').addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset button
    document.getElementById('resetOptions').addEventListener('click', () => {
      this.resetSettings();
    });

    // Current site toggle
    document.getElementById('enableCurrentSite').addEventListener('change', (e) => {
      const hostname = document.getElementById('currentSiteUrl').textContent;
      if (hostname && hostname !== 'Unable to detect') {
        this.settings.enabledSites[hostname] = e.target.checked;
      }
    });
  }

  async saveSettings() {
    try {
      // Collect form data
      this.settings.baseCurrency = document.getElementById('baseCurrency').value;
      this.settings.apiKey = document.getElementById('apiKey').value.trim();
      this.settings.showOriginalOnHover = document.getElementById('showOriginalOnHover').checked;
      this.settings.animateConversions = document.getElementById('animateConversions').checked;
      this.settings.updateFrequency = document.getElementById('updateFrequency').value;
      
      // Handle current site setting
      const hostname = document.getElementById('currentSiteUrl').textContent;
      if (hostname && hostname !== 'Unable to detect') {
        this.settings.enabledSites[hostname] = document.getElementById('enableCurrentSite').checked;
      }

      // Save to storage
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set(this.settings, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      // Update UI
      this.updateDisabledSitesList();
      this.showStatus('Settings saved successfully!', 'success');
      
      // Notify background script to update rates with new base currency
      chrome.runtime.sendMessage({
        action: 'getExchangeRates',
        data: { baseCurrency: this.settings.baseCurrency }
      });

    } catch (error) {
      console.error('Error saving settings:', error);
      this.showStatus('Error saving settings. Please try again.', 'error');
    }
  }

  async resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      try {
        await new Promise((resolve, reject) => {
          chrome.storage.sync.clear(() => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });

        this.settings = { ...this.defaultSettings };
        this.populateForm();
        this.showStatus('Settings reset to default values.', 'success');
      } catch (error) {
        console.error('Error resetting settings:', error);
        this.showStatus('Error resetting settings. Please try again.', 'error');
      }
    }
  }

  showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message status-${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}

// Initialize options manager when DOM is loaded
const optionsManager = new OptionsManager();