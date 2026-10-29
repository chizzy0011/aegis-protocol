# Aegis Protocol (`aegis-protocol`)

> **Institutional Collateral Clearing, Bilateral DvP Repo, and Emerging Market Structured Credit on Stellar Soroban**

[![Soroban Contracts CI](https://github.com/chizzy0011/aegis-protocol/actions/workflows/contracts.yml/badge.svg)](https://github.com/chizzy0011/aegis-protocol/actions/workflows/contracts.yml)
[![SDK & Web CI](https://github.com/chizzy0011/aegis-protocol/actions/workflows/sdk-and-web.yml/badge.svg)](https://github.com/chizzy0011/aegis-protocol/actions/workflows/sdk-and-web.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Stellar Wave](https://img.shields.io/badge/Drips%20Wave-Stellar%20Program-38BDF8)](https://docs.drips.network/wave)

Aegis Protocol is an institutional-grade financial clearinghouse built natively on **Stellar Soroban**. Aegis combines Canton-style bilateral repurchase agreements (**DvP Repo**) for tokenized sovereign debt with high-yield **structured trade credit facilities** settled directly through Stellar's global network of licensed fiat anchors.

---

## 1. Executive Summary & Core Thesis

### The Sovereign Collateral Liquidity Trap
Institutions hold tens of millions in tokenized Treasuries and money market funds on Stellar (such as **Franklin Templeton BENJI**, **WisdomTree Prime**, and **Spiko Euro T-Bills** `eurSAFO`). However, until now, holders could not borrow working capital (USDC/EURC) against these positions without liquidating their bonds, forfeiting yield, and triggering taxable events.

On traditional Wall Street and on the Canton Network (via DTCC and Broadridge DLT), institutions conduct hundreds of billions daily in **Bilateral Repurchase Agreements (Repos)**. With the DTCC bringing tokenized securities to Stellar in 2027, Aegis delivers the foundational clearing, haircut validation, and Delivery-versus-Payment (DvP) infrastructure required by institutional desks today.

### The Non-US Structured Credit Gap
While tokenized US debt offers ~4.5–5.0% APY, emerging market exporters and commodity producers (cocoa, coffee, soya, agricultural freight) face local commercial bank interest rates exceeding 25–30%. Aegis bridges global USDC liquidity providers with verified trade receivables via **Senior/Junior risk tranches**, disbursing local currency directly into bank accounts via Stellar's native **SEP-24 / SEP-6 fiat anchors** (Cowrie in Nigeria, Mercado Bitcoin in Brazil, Tempo in Europe, and ClickPesa in East Africa).

---

## 2. High-Level System Architecture

```mermaid
flowchart TD
    subgraph PrimeRepoDesk["Facility A: Bilateral Repo & DvP Clearing"]
        InstitutionalHolder["Institutional Bondholder\n(Spiko, BENJI, WisdomTree)"] -->|1. Pledges Collateral| RepoContract["Soroban Repo Engine\n(aegis-repo)"]
        RepoContract -->|2. Validates Haircut & Term| Escrow["Collateral Escrow Vault"]
        CashLender["USDC / EURC Cash Lender"] -->|3. Supplies Cash| DvPExecution["Atomic DvP Settlement"]
        DvPExecution -->|4. Cash Disbursed| InstitutionalHolder
        InstitutionalHolder -->|5. Matured Repurchase (Principal + Repo APR)| RepoContract
        RepoContract -->|6. Releases Collateral| InstitutionalHolder
    end

    subgraph StructuredCredit["Facility B: Emerging Market Trade Credit"]
        Exporter["Commodity Exporter\n(Cocoa, Soya, Freight)"] -->|1. Tokenizes Invoices| CreditPool["Soroban Credit Pool\n(aegis-credit)"]
        GlobalSeniorLP["Senior LPs (Protected: 8.5% APY)"] -->|2a. Senior Tranche| TrancheEngine["Tranche Waterfall Engine"]
        GlobalJuniorLP["Junior LPs (Equity: 16.5% APY)"] -->|2b. First-Loss Tranche| TrancheEngine
        TrancheEngine -->|3. Pooled Capital| SettlementHook["Anchor Settlement Contract\n(aegis-settlement)"]
        SettlementHook -->|4. SEP-24 / SEP-6 Off-Ramp| FiatAnchors["Stellar Fiat Anchors\n(Cowrie, Mercado Bitcoin, Tempo)"]
        FiatAnchors -->|5. Local Bank Payout (NGN, BRL, EUR)| Exporter
        Exporter -->|6. Invoice Repaid by Off-Taker| SettlementHook
        SettlementHook -->|7. Waterfall Repayment| TrancheEngine
    end

    subgraph ComplianceGate["Institutional Compliance & Regulation"]
        SEP8Gate["Soroban SEP-8 Compliance Contract\n(aegis-compliance)"]
        SEP8Gate -.->|Whitelists & Sanctions Check| RepoContract
        SEP8Gate -.->|Accredited Investor Verification| CreditPool
    end
```

---

## 3. Protocol Facilities

### Facility A: Canton-Grade Bilateral Repo (`contracts/repo`)
* **Underlying Collateral**: Sovereign T-Bills and money market funds (Spiko `eurSAFO`, Franklin Templeton `BENJI`, WisdomTree).
* **Haircut Model**: Dynamic haircuts (2.0% for AAA sovereign paper; tiered based on duration and volatility).
* **Settlement**: 100% atomic Delivery-versus-Payment (DvP) within a single Soroban ledger invocation.
* **Maturity Terms**: Overnight (24h), 7-day, 14-day, and 30-day fixed-term agreements with automatic liquidation upon grace period expiration.

### Facility B: Emerging Market Structured Credit (`contracts/credit`)
* **Underlying Collateral**: Verified export invoices, customs declarations, and digital bills of lading (SEP-41).
* **Tranche Waterfall Architecture**:
  * **Senior Tranche (Protected)**: 70–85% of facility. Earns 8.0–9.5% APY. First-loss protected by junior equity.
  * **Junior Tranche (First-Loss Equity)**: 15–30% of facility. Earns 16.0–19.0% APY. Absorbs initial impairment.
* **Fiat Settlement Hooks**: Automatic disbursement via Stellar anchors into recipient bank accounts across Africa, Latin America, and Europe.

### Compliance Layer: Institutional Gatekeeper (`contracts/compliance`)
* **SEP-8 Transfer Approval**: Every secondary bond movement and tranche position transfer requires on-chain accredited investor attestation.
* **Real-Time Sanctions Screening**: Rejects interactions from sanctioned entities or non-FATF compliant jurisdictions.

---

## 4. Repository Structure

```
aegis-protocol/
├── contracts/
│   ├── repo/           # Bilateral Repurchase Agreement & DvP Engine (Rust)
│   ├── credit/         # Structured Trade Finance Tranche Pool (Rust)
│   ├── compliance/     # Institutional KYC & SEP-8 Compliance Gatekeeper (Rust)
│   └── settlement/     # Stellar SEP-24 / SEP-6 Fiat Anchor Dispatch (Rust)
├── packages/
│   └── sdk/            # TypeScript SDK (@aegis-protocol/sdk)
├── services/
│   └── margin-watcher/ # Oracle Margin Monitor & Liquidator Daemon
├── apps/
│   └── web/            # Institutional Next.js 14 Trading & Clearing Portal
├── issues/
│   ├── issues.json     # 160 Curated Issues for Drips Wave
│   ├── ISSUES_CATALOG.md # Formatted Markdown Issue Catalog
│   └── seed-issues.js  # Automated GitHub Seeding Script
└── .github/workflows/
    ├── contracts.yml   # Rust & Soroban Contracts CI
    └── sdk-and-web.yml # TypeScript, SDK & Web CI
```

---

## 5. Drips Wave Program: 160-Issue Backlog

Aegis Protocol is configured for the **Drips Stellar Wave Program** with **160 distinct engineering issues** totaling **24,850 Points**:

| Complexity Tier | Points Per Issue | Total Issues | Tier Subtotal |
| :--- | :---: | :---: | :---: |
| **High** | 200 Pts | 65 | 13,000 Pts |
| **Medium** | 150 Pts | 55 | 8,250 Pts |
| **Trivial** | 100 Pts | 40 | 4,000 Pts |
| **Total Backlog** | — | **160 Issues** | **24,850 Pts** |

For the complete breakdown across all 8 modules, see the [Issues Catalog](file:///C:/Users/lenovo/aegis-protocol/issues/ISSUES_CATALOG.md).

---

## 6. Build and Verification

### Prerequisites
* Rust toolchain (stable) with `wasm32-unknown-unknown` target.
* Node.js v20+ or v22+.
* GitHub CLI (`gh`) for issue syncing.

### Build Contracts & Run Test Suite
```bash
# Run complete Soroban contract test suite
cargo test --all

# Compile contracts to Wasm
cargo build --target wasm32-unknown-unknown --release
```

### Build SDK, Relayer & Institutional Web Portal
```bash
# Install workspace dependencies
npm install --legacy-peer-deps

# Build TypeScript SDK
npm run build --workspace=@aegis-protocol/sdk

# Build Margin Watcher Daemon
npm run build --workspace=@aegis-protocol/margin-watcher

# Build Next.js Web Application
npm run build --workspace=@aegis-protocol/web
```

---

## 7. License

Licensed under the [Apache License, Version 2.0](file:///C:/Users/lenovo/aegis-protocol/LICENSE).
