// Content script for currency detection and conversion

class CurrencyDetector {
  constructor() {
    this.baseCurrency = 'USD';
    this.enabledSites = {};
    this.processedNodes = new WeakSet();
    
    this.currencyPatterns = {
      USD: { symbols: ['$', 'USD', 'US$'], priority: 1 },
      EUR: { symbols: ['€', 'EUR'], priority: 1 },
      GBP: { symbols: ['£', 'GBP'], priority: 1 },
      JPY: { symbols: ['¥', 'JPY', '円'], priority: 1 },
      CAD: { symbols: ['CA$', 'CAD', 'C$'], priority: 2 },
      AUD: { symbols: ['AU$', 'AUD', 'A$'], priority: 2 },
      CHF: { symbols: ['CHF', 'Fr'], priority: 2 },
      CNY: { symbols: ['¥', 'CNY', '元', 'RMB'], priority: 2 },
      INR: { symbols: ['₹', 'INR', 'Rs'], priority: 2 },
      KRW: { symbols: ['₩', 'KRW', '원'], priority: 2 },
      RUB: { symbols: ['₽', 'RUB', 'руб'], priority: 2 },
      BRL: { symbols: ['R$', 'BRL'], priority: 2 },
      MXN: { symbols: ['MX$', 'MXN'], priority: 2 },
      SGD: { symbols: ['S$', 'SGD'], priority: 2 },
      HKD: { symbols: ['HK$', 'HKD'], priority: 2 },
      NOK: { symbols: ['kr', 'NOK'], priority: 3 },
      SEK: { symbols: ['kr', 'SEK'], priority: 3 },
      DKK: { symbols: ['kr', 'DKK'], priority: 3 }
    };

    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupMutationObserver();
    this.processPage();
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

  isConversionEnabled() {
    const hostname = window.location.hostname;
    return this.enabledSites[hostname] !== false;
  }

  setupMutationObserver() {
    if (!this.isConversionEnabled()) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              this.processTextNode(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              this.processElement(node);
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  processPage() {
    if (!this.isConversionEnabled()) return;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      this.processTextNode(node);
    }
  }

  processElement(element) {
    if (this.processedNodes.has(element)) return;
    this.processedNodes.add(element);

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      this.processTextNode(node);
    }
  }

  processTextNode(textNode) {
    if (!textNode.parentNode || this.processedNodes.has(textNode)) return;
    
    const text = textNode.textContent;
    const currencies = this.detectCurrencies(text);
    
    if (currencies.length > 0) {
      this.processedNodes.add(textNode);
      this.convertCurrenciesInText(textNode, currencies);
    }
  }

  detectCurrencies(text) {
    const currencies = [];
    const processedPositions = new Set();

    // Sort currencies by priority to handle overlapping symbols
    const sortedCurrencies = Object.entries(this.currencyPatterns)
      .sort(([,a], [,b]) => a.priority - b.priority);

    for (const [code, config] of sortedCurrencies) {
      for (const symbol of config.symbols) {
        const regex = this.createCurrencyRegex(symbol);
        let match;

        while ((match = regex.exec(text)) !== null) {
          const start = match.index;
          const end = start + match[0].length;
          
          // Check if this position overlaps with a higher priority match
          let overlaps = false;
          for (let pos = start; pos < end; pos++) {
            if (processedPositions.has(pos)) {
              overlaps = true;
              break;
            }
          }

          if (!overlaps) {
            const amount = parseFloat(match[2] || match[3] || match[4]);
            if (!isNaN(amount) && amount > 0) {
              currencies.push({
                code,
                symbol,
                amount,
                match: match[0],
                start,
                end
              });

              // Mark positions as processed
              for (let pos = start; pos < end; pos++) {
                processedPositions.add(pos);
              }
            }
          }
        }
      }
    }

    return currencies.sort((a, b) => a.start - b.start);
  }

  createCurrencyRegex(symbol) {
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Various patterns for currency detection
    const patterns = [
      `(${escapedSymbol})\\s*([\\d,]+(?:\\.\\d{2})?)`, // $100.00
      `([\\d,]+(?:\\.\\d{2})?)\\s*(${escapedSymbol})`, // 100.00 USD
      `([\\d,]+(?:\\.\\d{2})?)\\s*${escapedSymbol}`, // 100.00$
      `(${escapedSymbol})([\\d,]+(?:\\.\\d{2})?)` // $100.00 (no space)
    ];

    return new RegExp(patterns.join('|'), 'gi');
  }

  async convertCurrenciesInText(textNode, currencies) {
    if (currencies.length === 0) return;

    let newHTML = textNode.textContent;
    let offset = 0;

    for (const currency of currencies) {
      if (currency.code === this.baseCurrency) continue;

      try {
        const convertedAmount = await this.convertCurrency(
          currency.amount,
          currency.code,
          this.baseCurrency
        );

        const originalText = currency.match;
        const convertedText = this.formatConvertedCurrency(
          originalText,
          convertedAmount,
          this.baseCurrency
        );

        const start = currency.start + offset;
        const end = currency.end + offset;

        newHTML = newHTML.substring(0, start) + convertedText + newHTML.substring(end);
        offset += convertedText.length - originalText.length;
      } catch (error) {
        console.error('Conversion failed:', error);
      }
    }

    if (newHTML !== textNode.textContent) {
      const span = document.createElement('span');
      span.innerHTML = newHTML;
      textNode.parentNode.replaceChild(span, textNode);
    }
  }

  formatConvertedCurrency(original, convertedAmount, toCurrency) {
    const formatted = this.formatCurrency(convertedAmount, toCurrency);
    return `<span class="currency-converted" title="Original: ${original}">${original} <span class="converted-value">(≈${formatted})</span></span>`;
  }

  formatCurrency(amount, currencyCode) {
    const symbols = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$',
      AUD: 'AU$', CHF: 'CHF', CNY: '¥', INR: '₹', KRW: '₩'
    };

    const symbol = symbols[currencyCode] || currencyCode;
    const roundedAmount = Math.round(amount * 100) / 100;
    
    if (currencyCode === 'JPY' || currencyCode === 'KRW') {
      return `${symbol}${Math.round(amount)}`;
    }
    
    return `${symbol}${roundedAmount.toFixed(2)}`;
  }

  async convertCurrency(amount, fromCurrency, toCurrency) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'convertCurrency',
        data: { amount, fromCurrency, toCurrency }
      }, (response) => {
        if (response.success) {
          resolve(response.convertedAmount);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }
}

// Initialize currency detector when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CurrencyDetector();
  });
} else {
  new CurrencyDetector();
}