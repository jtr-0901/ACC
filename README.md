Currency Converter Pro Browser Extension
Overview
Currency Converter Pro is a powerful browser extension that automatically detects and converts foreign currencies to your preferred base currency across all websites you visit.

Features
Automatic Currency Detection: Scans web pages for currency symbols and values
Real-time Conversion: Converts detected currencies to your base currency
Multi-Currency Support: Supports 18+ major international currencies
Smart Detection: Distinguishes between different currencies using the same symbol
Customizable Settings: Choose your base currency and configure extension behavior
Site Management: Enable/disable conversion for specific websites
Offline Support: Caches exchange rates for offline use
Performance Optimized: Lightweight and fast processing
Installation Instructions
For Chrome/Edge (Chromium-based browsers):
Download the Extension Files:

Copy all files from the extension/ folder to a new directory on your computer
Enable Developer Mode:

Open Chrome and navigate to chrome://extensions/
Toggle "Developer mode" in the top right corner
Load the Extension:

Click "Load unpacked"
Select the folder containing the extension files
The extension should now appear in your extensions list
Configure API Key (Recommended):

Get a free API key from ExchangeRate-API
Right-click the extension icon and select "Options"
Enter your API key in the settings page
For Firefox:
Prepare for Firefox:
Update the manifest.json to use manifest_version: 2 for Firefox compatibility
Navigate to about:debugging in Firefox
Click "This Firefox" → "Load Temporary Add-on"
Select the manifest.json file
Configuration
Setting Your Base Currency:
Right-click the extension icon
Select "Options"
Choose your preferred base currency from the dropdown
Save settings
Managing Websites:
Use the popup to quickly enable/disable conversion for the current site
Access the options page to manage all disabled sites
The extension remembers your preferences for each website
API Configuration:
The extension works with free tier API limits
For heavy usage, configure your own API key in the options page
Supports ExchangeRate-API and Fixer.io as backup
Supported Currencies
USD (US Dollar)
EUR (Euro)
GBP (British Pound)
JPY (Japanese Yen)
CAD (Canadian Dollar)
AUD (Australian Dollar)
CHF (Swiss Franc)
CNY (Chinese Yuan)
INR (Indian Rupee)
KRW (South Korean Won)
RUB (Russian Ruble)
BRL (Brazilian Real)
MXN (Mexican Peso)
SGD (Singapore Dollar)
HKD (Hong Kong Dollar)
NOK (Norwegian Krone)
SEK (Swedish Krona)
DKK (Danish Krone)
How It Works
Content Scanning: The extension continuously monitors web page content
Currency Detection: Uses advanced regex patterns to identify currency symbols and amounts
Smart Recognition: Prioritizes currency symbols to handle conflicts (e.g., $ for USD vs CAD)
API Conversion: Fetches real-time exchange rates from reliable APIs
Display: Shows converted amounts alongside original values with hover tooltips
Privacy & Security
No personal data is collected or stored
Only currency amounts and exchange rates are processed
All data is stored locally in your browser
API calls are made only for exchange rate updates
Troubleshooting
Extension Not Working:
Check if the extension is enabled in your browser settings
Verify that the current site isn't disabled in the extension options
Try refreshing the exchange rates from the popup
Conversion Issues:
Ensure you have an internet connection for rate updates
Check if your API key is valid (if using custom key)
Try resetting settings to default in the options page
Performance Issues:
The extension is optimized for performance but may slow down on pages with excessive currency amounts
Disable the extension on problematic sites if needed
Development
The extension consists of:

manifest.json: Extension configuration
content.js: Main currency detection and conversion logic
background.js: Service worker for API calls and data management
popup.html/js: Quick access interface
options.html/js: Configuration interface
styles.css: Visual styling for converted currencies
License
This extension is provided as-is for educational and personal use.

Support
For issues or feature requests, please check the browser extension documentation or create an issue in the project repository.
