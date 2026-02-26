# Delaware Franchise Tax Calculation Reference

> Last synced: 2026-02-27. Confirm with the [official source](https://corp.delaware.gov/frtaxcalc/) before filing.

## Overview

Delaware offers two methods for calculating franchise tax for C-Corps. The state automatically calculates using the **Authorized Shares Method** unless you provide the additional information needed for the **Assumed Par Value Capital Method**. You may use whichever method produces the lower tax.

**LLCs, LPs, and GPs** pay a flat $300 annual tax with no calculation required.

---

## Method 1: Authorized Shares Method

Tax is based solely on the number of authorized shares, regardless of par value or assets.

### Rate Schedule

| Authorized Shares | Tax |
|-------------------|-----|
| 5,000 or fewer | $175 (minimum) |
| 5,001 - 10,000 | $250 |
| Each additional 10,000 (or portion thereof) | +$85 |

**Maximum tax**: $200,000

### Example: 10,000,000 Authorized Shares

```
First 10,000 shares:                          $250
Remaining: 10,000,000 - 10,000 = 9,990,000
  9,990,000 / 10,000 = 999 increments         999 x $85 = $84,915

Total franchise tax: $250 + $84,915 = $85,165
```

### Example: 1,000 Authorized Shares

```
1,000 <= 5,000: $175

Total franchise tax: $175
```

---

## Method 2: Assumed Par Value Capital (APVC) Method

Almost always produces a lower tax for startups with low par value stock and modest assets. Requires total gross assets and total issued shares.

### Required Inputs

- **Total authorized shares** by class, with par value for each class
- **Total issued shares** (including treasury shares) as of December 31
- **Total gross assets** as reported on IRS Form 1120, Schedule L, Line 15 (Column B — beginning of year, or Column D — end of year, whichever the company uses for the filing year). If the company has not yet filed Form 1120, estimate from: bank balances + investments + accounts receivable + property + other assets.

### Step-by-Step Calculation

```
Step 1: Calculate Assumed Par Value
        Assumed Par = Total Gross Assets / Total Issued Shares
        (If no shares issued, assumed par = $0; use stated par for all classes)

Step 2: Compare assumed par to stated par for each class of stock:
        - If assumed par >= stated par: use assumed par x authorized shares in class
        - If assumed par <  stated par: use stated par x authorized shares in class

Step 3: Sum results from Step 2 across all classes = Assumed Par Value Capital (APVC)

Step 4: Calculate tax
        Tax = (APVC rounded up to next $1,000,000 / $1,000,000) x $400
        Minimum: $400
        Maximum: $200,000
```

### Example: Single Class, Low Par Value Startup

**Given:**
- 10,000,000 authorized shares of Common Stock at $0.00001 par value
- 2,000,000 issued shares
- $100,000 total gross assets

```
Step 1: Assumed Par = $100,000 / 2,000,000 = $0.05
Step 2: $0.05 >= $0.00001 (assumed par >= stated par)
        Use assumed par: $0.05 x 10,000,000 = $500,000
Step 3: APVC = $500,000
Step 4: Round $500,000 up to $1,000,000
        $1,000,000 / $1,000,000 = 1
        Tax = 1 x $400 = $400
```

**Result: $400** (vs. $85,165 under Authorized Shares Method)

### Example: Multiple Classes with Preferred Stock

**Given:**
- Class A Common: 8,000,000 authorized at $0.00001 par
- Series Seed Preferred: 2,000,000 authorized at $0.001 par
- Total issued: 3,000,000 shares (2,500,000 Common + 500,000 Preferred)
- Total gross assets: $2,500,000

```
Step 1: Assumed Par = $2,500,000 / 3,000,000 = $0.8333
Step 2:
  Common:   $0.8333 >= $0.00001 -> use $0.8333 x 8,000,000 = $6,666,667
  Preferred: $0.8333 >= $0.001  -> use $0.8333 x 2,000,000 = $1,666,667
Step 3: APVC = $6,666,667 + $1,666,667 = $8,333,333
Step 4: Round up to $9,000,000
        $9,000,000 / $1,000,000 = 9
        Tax = 9 x $400 = $3,600
```

**Result: $3,600**

---

## Special Rules

### Mid-Year Amendments to Authorized Shares

If the certificate of incorporation is amended during the year to increase authorized shares, the franchise tax is prorated:
- Tax for the period before the amendment is based on the prior authorization
- Tax for the period after the amendment is based on the new authorization
- Both periods are calculated at the annual rate, then prorated by months

### Payment Schedule for Taxes >= $5,000

Corporations with an annual franchise tax of **$5,000 or more** must pay in quarterly installments:

| Due Date | Percentage of Estimated Annual Tax |
|----------|-----------------------------------|
| June 1 | 40% |
| September 1 | 20% |
| December 1 | 20% |
| March 1 (following year) | Remainder (at least 20%) |

Failure to make quarterly payments results in penalty and interest on each missed installment.

### Minimum and Maximum Tax

| Entity Type | Minimum Tax | Maximum Tax |
|-------------|-------------|-------------|
| C-Corp (Authorized Shares) | $175 | $200,000 |
| C-Corp (APVC) | $400 | $200,000 |
| LLC / LP / GP | $300 (flat) | $300 (flat) |

---

## Large Corporate Filers

A corporation qualifies as a Large Corporate Filer if it meets **both** criteria:
1. Listed on a national stock exchange (NYSE, NASDAQ, etc.)
2. Reports **$750 million or more** in consolidated annual gross revenues **or** consolidated assets

Large Corporate Filers pay a flat franchise tax of **$250,000** per year, regardless of authorized shares or assets.

---

## Important Notes

- The Assumed Par Value Capital Method almost always produces a lower tax for startups and private companies. Always calculate both methods.
- "Issued shares" includes treasury shares. Do not subtract treasury shares from the count.
- "Gross assets" means total assets before depreciation or other deductions. Use the figure from Form 1120, Schedule L, Line 15.
- If gross assets are zero or no shares have been issued, only the Authorized Shares Method applies.

**Official calculator reference**: https://corp.delaware.gov/frtaxcalc/
