// Content script for currency detection and conversion

class CurrencyDetector {
  constructor() {
    this.baseCurrency = 'USD';
    this.enabledSites = {};
    this.processedNodes = new WeakSet();
    this.processedElements = new WeakSet();
    this.isProcessing = false;
    
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
    if (this.isConversionEnabled()) {
      this.setupMutationObserver();
      // Delay initial processing to avoid conflicts
      setTimeout(() => this.processPage(), 1000);
    }
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
    const observer = new MutationObserver((mutations) => {
      if (this.isProcessing) return;
      
      let shouldProcess = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            // Skip our own converted elements
            if (node.nodeType === Node.ELEMENT_NODE && 
                (node.classList?.contains('currency-converted') || 
                 node.querySelector?.('.currency-converted'))) {
              return;
            }
            
            if (node.nodeType === Node.TEXT_NODE && !this.processedNodes.has(node)) {
              shouldProcess = true;
            } else if (node.nodeType === Node.ELEMENT_NODE && !this.processedElements.has(node)) {
              shouldProcess = true;
            }
          });
        }
      });
      
      if (shouldProcess) {
        // Debounce processing to avoid rapid-fire mutations
        clearTimeout(this.processingTimeout);
        this.processingTimeout = setTimeout(() => {
          this.processNewMutations(mutations);
        }, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  processNewMutations(mutations) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          // Skip our own converted elements
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node.classList?.contains('currency-converted') || 
               node.querySelector?.('.currency-converted'))) {
            return;
          }
          
          if (node.nodeType === Node.TEXT_NODE) {
            this.processTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            this.processElement(node);
          }
        });
      }
    });
    
    this.isProcessing = false;
  }

  processPage() {
    if (this.isProcessing || !this.isConversionEnabled()) return;
    this.isProcessing = true;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip already processed nodes and converted elements
          if (this.processedNodes.has(node)) return NodeFilter.FILTER_REJECT;
          
          const parent = node.parentElement;
          if (parent && (parent.classList.contains('currency-converted') || 
                        parent.closest('.currency-converted'))) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    const nodesToProcess = [];
    let node;
    while (node = walker.nextNode()) {
      nodesToProcess.push(node);
    }

    // Process nodes in batches to avoid blocking
    this.processBatch(nodesToProcess, 0);
  }

  processBatch(nodes, startIndex) {
    const batchSize = 10;
    const endIndex = Math.min(startIndex + batchSize, nodes.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      this.processTextNode(nodes[i]);
    }
    
    if (endIndex < nodes.length) {
      // Process next batch after a short delay
      setTimeout(() => this.processBatch(nodes, endIndex), 10);
    } else {
      this.isProcessing = false;
    }
  }

  processElement(element) {
    if (this.processedElements.has(element) || 
        element.classList?.contains('currency-converted') ||
        element.closest?.('.currency-converted')) {
      return;
    }
    
    this.processedElements.add(element);

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (this.processedNodes.has(node)) return NodeFilter.FILTER_REJECT;
          
          const parent = node.parentElement;
          if (parent && (parent.classList.contains('currency-converted') || 
                        parent.closest('.currency-converted'))) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    let node;
    while (node = walker.nextNode()) {
      this.processTextNode(node);
    }
  }

  processTextNode(textNode) {
    if (!textNode.parentNode || 
        this.processedNodes.has(textNode) ||
        textNode.parentElement?.classList?.contains('currency-converted') ||
        textNode.parentElement?.closest?.('.currency-converted')) {
      return;
    }
    
    const text = textNode.textContent;
    
    // Skip if text contains conversion indicators (already processed)
    if (text.includes('≈') || text.includes('(≈')) {
      this.processedNodes.add(textNode);
      return;
    }
    
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
            const amount = parseFloat((match[2] || match[3] || match[4] || match[1]).replace(/,/g, ''));
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
    
    // More precise patterns to avoid matching converted values
    const patterns = [
      `(?<!≈)(?<!\\()${escapedSymbol}\\s*([\\d,]+(?:\\.\\d{1,2})?)(?!\\s*\\(≈)`, // $100.00 but not (≈$100.00)
      `(?<!≈)(?<!\\()([\\d,]+(?:\\.\\d{1,2})?)\\s*${escapedSymbol}(?!\\s*\\(≈)`, // 100.00 USD but not 100.00 USD (≈...)
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
      
      // Mark the new element as processed
      span.querySelectorAll('.currency-converted').forEach(el => {
        this.processedElements.add(el);
      });
      
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
      return `${symbol}${Math.round(amount).toLocaleString()}`;
    }
    
    return `${symbol}${roundedAmount.toFixed(2)}`;
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
}

// Initialize currency detector when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CurrencyDetector();
  });
} else {
  new CurrencyDetector();
}