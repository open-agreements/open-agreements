# Delaware eCorp Portal — Playwright Automation Notes

## Setup

### Launch Chrome with remote debugging

```bash
# Must quit Chrome first, then relaunch with debug port
osascript -e 'tell application "Google Chrome" to quit'
sleep 2
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-profile &
```

### Connect via Playwright (CDP)

```python
NODE_OPTIONS='--no-deprecation' uv run python3 << 'PYEOF'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:9222")
    ctx = browser.contexts[0]
    page = ctx.pages[0]
PYEOF
```

## Fixes & Gotchas

### 1. Readonly "Total Issued Shares" field
- `gridStock_ctl02_txtIssuedShares` is **readonly** — it's auto-summed from per-class fields
- Fill the per-class field instead: `gridStock_ctl02_gridStockDetails_ctl02_txtIssuedShares`
- This populates the readonly total automatically on recalculate

### 2. Asset Date field mangles input with Playwright .fill()/.type()
- The date field has a mask/formatter that garbles Playwright keyboard input
- **Fix**: Use JavaScript to set the value directly:
  ```python
  page.evaluate('''
      const el = document.getElementById('ctl00_ContentPlaceHolder1_gridStock_ctl02_txtAssetDate');
      el.value = '12/31/2025';
      el.dispatchEvent(new Event('change', { bubbles: true }));
  ''')
  ```
- The portal requires asset date == fiscal year end date, or it ignores gross assets

### 3. APVC method activation
- Portal defaults to Authorized Shares method ($85,165 for 10M shares)
- To get APVC: fill issued shares + gross assets + correct asset date, then click "Recalculate Tax"
- If asset date doesn't match fiscal year end, recalculate silently stays on Authorized Shares

### 4. ASP.NET ViewState breaks on back-navigation
- Never use `page.go_back()` — the ViewState expires and you get a server error
- Always start fresh from the login page: `https://icis.corp.delaware.gov/ecorp/logintax.aspx`

### 5. Postback links (2024 "File Amended Annual Report")
- The link is `javascript:__doPostBack(...)`, not a real URL
- Can't open in a new tab via href — must execute on the page
- Use: `page.evaluate("__doPostBack('ctl00$ContentPlaceHolder1$lnkPrevAR','')")`

### 6. CAPTCHA
- Field: `#ctl00_ContentPlaceHolder1_ecorpCaptcha1_txtCaptcha`
- Image: `#ctl00_ContentPlaceHolder1_ecorpCaptcha1_captchaImage` (NOT `img[src*='Captcha']`)
- Case-insensitive in practice (all caps in image)
- Screenshot cropping can be unreliable — fetch the CAPTCHA image bytes via JS `fetch()` on `img.src` as fallback

### 7. Key field selectors
| Field | Selector ID (after ctl00_ContentPlaceHolder1_) |
|-------|------------------------------------------------|
| File number | txtPrimaryFileNo |
| CAPTCHA | ecorpCaptcha1_txtCaptcha |
| Continue button | btnContinue |
| Issued shares (per-class) | gridStock_ctl02_gridStockDetails_ctl02_txtIssuedShares |
| Issued shares (total, readonly) | gridStock_ctl02_txtIssuedShares |
| Gross assets | gridStock_ctl02_txtGrossAsset |
| Asset date | gridStock_ctl02_txtAssetDate |
| Fiscal year end | txtFiscalYearEndYear |
| Recalculate button | btnRecalucation (note: typo in portal) |
| Continue Filing button | btnProceedPayment |
| Enter Directors button | btnDisplayDirectorForm |
| Nature of Business | ddlBusinessNatures |

### 8. State dropdowns use abbreviations (NY, WA, etc.)
- All state dropdowns (`drpHidePrincipal`, `drpHideOfficer`, `drpHideAuthor`, `drpDirectorStatesN`) use 2-letter state codes
- Use `page.select_option("#drpHidePrincipal", value="NY")` — NOT `label="New York"`

### 9. Director form fields (inline, not popup)
- Click `#btnDisplayDirectorForm` to reveal director rows
- **CRITICAL**: Director names have THREE separate fields per director:
  - `txtDirectorName{N}` = **first name only** (NOT full name!)
  - `txtMiddleName{N}` = middle name/initial
  - `txtLastName{N}` = last name (REQUIRED — validation fails without it)
- Other fields: `txtDirectorAddress{N}`, `txtDirectorCity{N}`, `drpDirectorStates{N}`, `txtDirectorZip{N}`, `drpDirectorCountry{N}`
- Numbered 1–N based on `txtTotalNumOfDirectors`
- All use simple IDs (no ASP.NET prefix)

### 10. Tax result label IDs (different from what you'd expect)
| Label | Selector ID (after ctl00_ContentPlaceHolder1_) |
|-------|------------------------------------------------|
| Franchise Tax | lblFranchisetaxData |
| Penalty | lblPenaltyData |
| Interest | lblMonthlyIntrestData |
| Filing Fee | lblAnnualFilingDta |
| Credit | lblPreviousData |
| Prepaid | lblPrepaidPaymentData |
| **Total Due** | **lblAmountDue** |

### 11. Officer and Authorization address fields
| Section | Street | City | State | Zip |
|---------|--------|------|-------|-----|
| Principal | txtStreetPrincipal | txtCityPrincipal | drpHidePrincipal | txtZipPrincipal |
| Officer | txtStreetOfficer | txtCityOfficer | drpHideOfficer | txtZipOfficer |
| Auth | txtStreetAuthorization | txtCityAuthorization | drpHideAuthor | txtZipAuthorization |

### 12. Session/eId behavior
- Dashboard URL needs `eId` parameter from login — can't bookmark dashboard directly
- **BUT**: Cmd+Back (browser history) in a new tab CAN get back to dashboard within the same session
- Each login generates a unique eId; session cookies are shared across tabs

### 13. T&C checkbox required before Continue Filing
- Must check `#ctl00_ContentPlaceHolder1_chkCertify` before clicking Continue Filing
- Validation error: "Authorization: Please check the box to confirm that you have read the Terms and Conditions"

### 14. Confirmation page — save BEFORE navigating away
- **"Once you leave this screen, you will no longer be able to obtain a confirmation copy"**
- **PDF download**: `downloadConfirmation()` → opens `DownLoadConfirmation.ashx?srNo=...&fileNo=...`
  - Triggers a file download, NOT a page navigation — Playwright will throw "Download is starting" error (that's OK, the file downloads)
- **Email confirmation**: `openARemail()` → opens `Email.aspx?srNo=...` popup
  - Fill `#txtEmailAddress` and `#txtVerifyEmailAddress`, click `#btnEmail`
  - Response: "Your e-mail request has been received. Please allow 48 hours."
- Service Request Number is in the URL: `?srNo=XXXXXXXXXXX`

### 15. Deprecation warning
- `[DEP0169] url.parse() behavior is not standardized` comes from Playwright's Node.js internals
- Harmless — Playwright uses `url.parse()` in its server; fix is upstream (Playwright issue)
- Suppress with: `NODE_OPTIONS='--no-deprecation'` env var
