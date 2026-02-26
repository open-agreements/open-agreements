---
name: delaware-franchise-tax
description: >-
  File your Delaware annual franchise tax and annual report. Guides you through
  tax calculation (Authorized Shares and Assumed Par Value Capital methods),
  the eCorp portal filing process, and payment. For Delaware C-Corps (March 1
  deadline) and LLCs/LPs/GPs (June 1 deadline).
license: MIT
metadata:
  author: open-agreements
  version: "0.1.0"
---

# Delaware Franchise Tax

File your Delaware annual franchise tax and annual report.

> **Interactivity note**: Always ask the user for missing inputs.
> If your agent has an `AskUserQuestion` tool (Claude Code, Cursor, etc.),
> prefer it — structured questions are easier for users to answer.
> Otherwise, ask in natural language.

## Security model

- This skill **does not** download or execute any code.
- It **does not** access the Delaware eCorp portal programmatically (the portal prohibits automated tools).
- All portal interactions are performed by the user, guided step-by-step by the agent.

## When to Use

- Annually before **March 1** (C-Corps) or **June 1** (LLCs/LPs/GPs)
- When your registered agent sends a reminder
- When you receive a notice from the Delaware Division of Corporations
- **Portal hours**: 8:00am-11:45pm ET only
- **Scam warning**: Delaware warns about deceptive solicitations. Legitimate notices come from the state or your registered agent only. Discard anything that asks you to pay through a non-official channel.

## Phase 1: Gather Information

Ask the user for the following (use `AskUserQuestion` if available):

**All entity types:**
- Entity type: **C-Corp** or **LLC/LP/GP**
- Delaware Business Entity File Number (up to 9 digits)
- Registered agent name

**For C-Corps, also ask:**
- Total authorized shares by class and par value (e.g., 10,000,000 shares of Common Stock at $0.00001 par value)
- Total issued and outstanding shares as of December 31 of the tax year
- Total gross assets as of December 31 (from Form 1120 Schedule L, Line 15 — or estimated from bank balance + investments + receivables)
- Nature of business (brief description of how the company generates revenue)

**Officers and directors (C-Corps):**
- Officers: names, titles, addresses
- Directors: names, addresses

## Phase 2: Calculate Tax

### LLCs/LPs/GPs

Flat **$300** annual tax. No calculation needed. Skip to Phase 3.

### C-Corps — Calculate Both Methods

Always calculate both methods and recommend the lower one. Show all intermediate values so the user can verify.

#### Method 1: Authorized Shares Method

```
Shares <= 5,000:        $175 (minimum)
5,001 - 10,000:         $250
Each additional 10,000: +$85
Maximum:                $200,000
```

**Example**: 10,000,000 authorized shares
- First 10,000 shares: $250
- Remaining 9,990,000 shares = 999 increments of 10,000: 999 x $85 = $84,915
- Total: $250 + $84,915 = **$85,165**

#### Method 2: Assumed Par Value Capital (APVC) Method

Almost always cheaper for startups. Requires a gross assets figure.

```
Step 1: Assumed Par = Total Gross Assets / Total Issued Shares
Step 2: For each class of shares where assumed par >= stated par:
        use assumed par x number of authorized shares in that class
Step 3: For each class of shares where assumed par < stated par:
        use stated par x number of authorized shares in that class
Step 4: Sum all classes = Assumed Par Value Capital (APVC)
Step 5: Tax = (APVC rounded up to next $1,000,000 / $1,000,000) x $400
Step 6: Minimum tax: $400
Step 7: Maximum tax: $200,000
```

**Example**: 10,000,000 authorized shares at $0.00001 par, 1,000,000 issued, $50,000 gross assets
- Step 1: Assumed Par = $50,000 / 1,000,000 = $0.05
- Step 2: $0.05 >= $0.00001, so use assumed par: $0.05 x 10,000,000 = $500,000
- Step 4: APVC = $500,000
- Step 5: Round up to $1,000,000 -> 1 x $400 = **$400**

#### Filing Fee

- **$50** for non-exempt domestic corporations
- **$25** for 501(c)(3) exempt corporations

**Total due = franchise tax + filing fee**

Present both calculations to the user:
```
Method 1 (Authorized Shares): $XX,XXX
Method 2 (Assumed Par Value):  $XXX
Recommended method:            Method 2
Filing fee:                    $50
Total due:                     $XXX + $50 = $XXX
```

## Phase 3: File via Portal

Guide the user step by step. The agent reads instructions aloud; the user operates the browser.

1. **Navigate**: Open https://icis.corp.delaware.gov/ecorp/logintax.aspx
2. **Login**: Enter Business Entity File Number. Solve CAPTCHA (if the user shares a screenshot, the agent can try to read it). Click **Continue**.
3. **Entity verification**: Confirm entity name, registered agent, and registered office match your records.
4. **Officers and directors**: Review and confirm or update names and addresses. Enter Nature of Business if prompted.
5. **Stock information**: Enter authorized shares, par value, issued shares, and gross assets for each class.
6. **Tax method**: Select **Assumed Par Value Capital Method** (or whichever method produced the lower tax). Verify the displayed tax matches your calculation from Phase 2. If it does not match, stop and troubleshoot before proceeding.
7. **Payment**: Enter credit card or ACH details. Total = tax + filing fee. **Click Submit ONCE** — the portal warns about duplicate charges on double-click. If tax exceeds $5,000, ACH payment is required.
8. **Confirmation**: Save the confirmation number. Screenshot the confirmation page.

## Phase 4: Record and Remind

Save a filing record with the following details:
- Entity name
- Delaware file number
- Tax year
- Calculation method used and intermediate values
- Amount paid (tax + filing fee)
- Confirmation number
- Date filed
- Next due date (March 1 of next year for corps, June 1 for LLCs)

Remind the user to set an annual reminder for approximately 2 weeks before the deadline:
- **Mid-February** for corporations (March 1 deadline)
- **Mid-May** for LLCs/LPs/GPs (June 1 deadline)

**Scheduling options:**
- **Claude Cowork**: `/schedule` for recurring tasks
- **Claude Code CLI**: external scheduler (cron, LaunchAgent)
- **Any calendar app**: set a recurring annual reminder
- If `~~calendar` MCP is available, create the reminder directly

## Reference

For detailed calculation formulas and official guidance, see the `reference/` directory:
- `reference/tax-calculation.md` — full formulas for both methods with examples
- `reference/filing-instructions.md` — fees, payment methods, deadlines
- `reference/faq.md` — frequently asked questions

**Official source**: https://corp.delaware.gov/paytaxes/
**Help line**: 302-739-3073, Option 3

## Notes

- This skill does not provide tax advice — consult a tax professional for your specific situation.
- The Delaware Division of Corporations portal is the only official filing method.
- Late filing incurs a **$200 penalty + 1.5% monthly interest**.
- If franchise tax exceeds **$5,000**, ACH payment is required (credit cards not accepted above this threshold).
- **Large Corporate Filers** (listed on a national stock exchange with $750M+ in revenue or assets) pay a flat **$250,000**.
