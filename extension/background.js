// Background service worker for the Currency Converter extension

class CurrencyService {
  constructor() {
    this.BASE_URL = 'https://api.exchangerate-api.com/v4/latest/';
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
    try {
      const result = await chrome.storage.local.get([`rates_${baseCurrency}`]);
      return result[`rates_${baseCurrency}`] || null;
    } catch (error) {
      console.error('Error getting cached rates:', error);
      return null;
    }
  }

  async cacheRates(baseCurrency, rates) {
    try {
      const cacheData = {
        rates,
        timestamp: Date.now()
      };
      
      await chrome.storage.local.set({ [`rates_${baseCurrency}`]: cacheData });
    } catch (error) {
      console.error('Error caching rates:', error);
    }
  }

  isCacheValid(timestamp) {
    return (Date.now() - timestamp) < this.CACHE_DURATION;
  }

  async convertCurrency(amount, fromCurrency, toCurrency) {
    try {
      if (fromCurrency === toCurrency) {
        return amount;
      }

      const rates = await this.getExchangeRates(fromCurrency);
      
      if (rates && rates[toCurrency]) {
        return amount * rates[toCurrency];
      }
      
      // Try reverse conversion
      const reverseRates = await this.getExchangeRates(toCurrency);
      if (reverseRates && reverseRates[fromCurrency]) {
        return amount / reverseRates[fromCurrency];
      }
      
      throw new Error(`Conversion rate not found for ${fromCurrency} to ${toCurrency}`);
    } catch (error) {
      console.error('Currency conversion error:', error);
      throw error;
    }
  }
}

const currencyService = new CurrencyService();

// Handle messages from content scripts and popup
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

// Initialize on extension startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    const result = await chrome.storage.sync.get(['baseCurrency']);
    const baseCurrency = result.baseCurrency || 'USD';
    await currencyService.getExchangeRates(baseCurrency);
    console.log('Exchange rates updated on startup');
  } catch (error) {
    console.error('Failed to update exchange rates on startup:', error);
  }
});

// Also initialize when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const result = await chrome.storage.sync.get(['baseCurrency']);
    const baseCurrency = result.baseCurrency || 'USD';
    await currencyService.getExchangeRates(baseCurrency);
    console.log('Exchange rates updated on install');
  } catch (error) {
    console.error('Failed to update exchange rates on install:', error);
  }
});