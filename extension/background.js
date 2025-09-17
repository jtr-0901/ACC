// Background service worker for the Currency Converter extension

class CurrencyService {
  constructor() {
    this.API_KEY = 'YOUR_API_KEY'; // Replace with actual API key
    this.BASE_URL = 'https://api.exchangerate-api.com/v4/latest/';
    this.FALLBACK_URL = 'https://api.fixer.io/latest'; // Fallback API
    this.CACHE_DURATION = 3600000; // 1 hour in milliseconds
  }

  async getExchangeRates(baseCurrency = 'USD') {
    try {
      // Check cache first
      const cached = await this.getCachedRates(baseCurrency);
      if (cached && this.isCacheValid(cached.timestamp)) {
        return cached.rates;
      }

      // Fetch new rates
      const response = await fetch(`${this.BASE_URL}${baseCurrency}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the results
      await this.cacheRates(baseCurrency, data.rates);
      
      return data.rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      
      // Return cached rates if available
      const cached = await this.getCachedRates(baseCurrency);
      if (cached) {
        return cached.rates;
      }
      
      throw error;
    }
  }

  async getCachedRates(baseCurrency) {
    return new Promise((resolve) => {
      chrome.storage.local.get([`rates_${baseCurrency}`], (result) => {
        resolve(result[`rates_${baseCurrency}`] || null);
      });
    });
  }

  async cacheRates(baseCurrency, rates) {
    const cacheData = {
      rates,
      timestamp: Date.now()
    };
    
    return new Promise((resolve) => {
      chrome.storage.local.set({ [`rates_${baseCurrency}`]: cacheData }, resolve);
    });
  }

  isCacheValid(timestamp) {
    return (Date.now() - timestamp) < this.CACHE_DURATION;
  }

  async convertCurrency(amount, fromCurrency, toCurrency) {
    try {
      const rates = await this.getExchangeRates(toCurrency);
      
      if (fromCurrency === toCurrency) {
        return amount;
      }
      
      // If converting from base currency
      if (rates[fromCurrency]) {
        return amount / rates[fromCurrency];
      }
      
      // If converting to base currency
      const baseRates = await this.getExchangeRates(fromCurrency);
      if (baseRates[toCurrency]) {
        return amount * baseRates[toCurrency];
      }
      
      throw new Error(`Conversion rate not found for ${fromCurrency} to ${toCurrency}`);
    } catch (error) {
      console.error('Currency conversion error:', error);
      throw error;
    }
  }
}

const currencyService = new CurrencyService();

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'convertCurrency') {
    const { amount, fromCurrency, toCurrency } = message.data;
    
    currencyService.convertCurrency(amount, fromCurrency, toCurrency)
      .then(convertedAmount => {
        sendResponse({ success: true, convertedAmount });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
  
  if (message.action === 'getExchangeRates') {
    const { baseCurrency } = message.data;
    
    currencyService.getExchangeRates(baseCurrency)
      .then(rates => {
        sendResponse({ success: true, rates });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});

// Update exchange rates on extension startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    const result = await chrome.storage.sync.get(['baseCurrency']);
    const baseCurrency = result.baseCurrency || 'USD';
    await currencyService.getExchangeRates(baseCurrency);
  } catch (error) {
    console.error('Failed to update exchange rates on startup:', error);
  }
});

// Update exchange rates daily
chrome.alarms.create('updateRates', { delayInMinutes: 1440 }); // 24 hours

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateRates') {
    try {
      const result = await chrome.storage.sync.get(['baseCurrency']);
      const baseCurrency = result.baseCurrency || 'USD';
      await currencyService.getExchangeRates(baseCurrency);
    } catch (error) {
      console.error('Failed to update exchange rates:', error);
    }
  }
});