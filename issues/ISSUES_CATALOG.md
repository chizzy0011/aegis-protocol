# Aegis Protocol: Drips Wave Issue Catalog

This catalog contains **160 distinct engineering issues** structured for the **Drips Stellar Wave Program**, covering institutional bilateral repo clearing (Canton-spec), structured trade credit tranche waterfalls, SEP-8 compliance, and Stellar native fiat anchor settlements.

**Total Planned Points:** **24,850 Points** across **160 Issues**.

| Tier | Count | Points Per Issue | Subtotal |
| :--- | :---: | :---: | :---: |
| **High** | 56 | 200 Pts | 11,200 Pts |
| **Medium** | 65 | 150 Pts | 9,750 Pts |
| **Trivial** | 39 | 100 Pts | 3,900 Pts |
| **Total** | **160** | â€” | **24,850 Pts** |

---
## Bilateral Repo & DvP Clearing Engine (20 Issues)

| ID | Title | Complexity | Points | Labels |
| :---: | :--- | :---: | :---: | :--- |
| #1 | contracts(repo): implement open-term repo rollover with dynamic rate reset | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "repo" |
| #2 | contracts(repo): implement dynamic haircut adjustment based on collateral volatility | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "repo" |
| #3 | contracts(repo): add partial collateral substitution mechanism during active repo term | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "repo" |
| #4 | contracts(repo): implement tri-party custodian agent authorization role | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "repo" |
| #5 | contracts(repo): add multi-currency repo settlement support for EURC and USDC | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "repo" |
| #6 | contracts(repo): implement grace period countdown timer for margin call remediations | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "repo" |
| #7 | contracts(repo): add tiered repo rate discount curves based on borrower credit rating | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "repo" |
| #8 | contracts(repo): implement early termination settlement penalty calculation | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "repo" |
| #9 | contracts(repo): add batch DvP execution endpoint for institutional portfolio rebalancing | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "repo" |
| #10 | contracts(repo): implement automated collateral yield pass-through to original borrower | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "repo" |
| #11 | contracts(repo): add minimum and maximum term bounds validation to repo proposals | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "repo" |
| #12 | contracts(repo): implement emergency pause and circuit breaker for repo clearing engine | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "repo" |
| #13 | contracts(repo): add event emission for all DvP state transitions | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "repo" |
| #14 | contracts(repo): implement repo position transferability for secondary market participation | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "repo" |
| #15 | contracts(repo): add protocol reserve fee deduction on repo interest settlements | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "repo" |
| #16 | contracts(repo): implement collateral rehypothecation limits and tracking | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "repo" |
| #17 | contracts(repo): add comprehensive fuzz testing for repo haircut calculations | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "repo" |
| #18 | contracts(repo): implement borrower default insurance fund waterfall integration | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "repo" |
| #19 | contracts(repo): add audit logging of borrower historical repo repayment performance | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "repo" |
| #20 | contracts(repo): optimize Soroban storage footprint for closed repo agreements | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "repo" |

## Structured Trade Credit & Tranche Waterfall (20 Issues)

| ID | Title | Complexity | Points | Labels |
| :---: | :--- | :---: | :---: | :--- |
| #21 | contracts(credit): implement automated senior tranche first-loss capital protection logic | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "credit" |
| #22 | contracts(credit): implement dynamic tranche ratio adjustments based on invoice risk grade | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "credit" |
| #23 | contracts(credit): add invoice factoring bill-of-lading verification oracle hook | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "credit" |
| #24 | contracts(credit): implement revolving credit facility mechanics for established exporters | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "credit" |
| #25 | contracts(credit): add multi-investor pro-rata tranche yield distribution claims | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "credit" |
| #26 | contracts(credit): implement early repayment discount incentive for trade borrowers | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "credit" |
| #27 | contracts(credit): add penalty interest accrual for past-due invoice facilities | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "credit" |
| #28 | contracts(credit): implement underwriter skin-in-the-game co-investment requirement | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "credit" |
| #29 | contracts(credit): add emergency debt restructuring and term extension vote | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "credit" |
| #30 | contracts(credit): implement automated currency hedging reserve for non-USD off-takers | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "credit" |
| #31 | contracts(credit): add minimum ticket size validation for accredited tranche investors | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "credit" |
| #32 | contracts(credit): implement typed event logging for all credit tranche state transitions | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "credit" |
| #33 | contracts(credit): add facility documentation IPFS hash immutability verification | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "credit" |
| #34 | contracts(credit): implement off-taker rating agency cross-reference verification | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "credit" |
| #35 | contracts(credit): add secondary liquidity market for senior tranche receipt tokens | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "credit" |
| #36 | contracts(credit): implement automated bad debt write-off protocol workflow | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "credit" |
| #37 | contracts(credit): add collateralized export inventory warehouse receipt integration | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "credit" |
| #38 | contracts(credit): implement tranche yield auto-compounding vault option | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "credit" |
| #39 | contracts(credit): add comprehensive unit test suite for tranche waterfall liquidation | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "credit" |
| #40 | contracts(credit): optimize ledger footprint of matured trade credit agreements | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "credit" |

## Institutional Compliance & SEP-8 Gates (20 Issues)

| ID | Title | Complexity | Points | Labels |
| :---: | :--- | :---: | :---: | :--- |
| #41 | contracts(compliance): implement automated sanctions screening list sync for OFAC and EU lists | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "compliance" |
| #42 | contracts(compliance): implement jurisdiction restriction matrix for US and FATF high-risk countries | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "compliance" |
| #43 | contracts(compliance): add accredited investor annual recertification countdown | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "compliance" |
| #44 | contracts(compliance): implement role-based compliance officer multi-signature authorization | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "compliance" |
| #45 | contracts(compliance): add SEP-8 transfer approval check for secondary tranche token transfers | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "compliance" |
| #46 | contracts(compliance): implement zero-knowledge KYC proof verification hook | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "compliance" |
| #47 | contracts(compliance): add entity type tagging for bank, fund, corporate treasury, and sovereign wealth | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "compliance" |
| #48 | contracts(compliance): implement temporary freeze mechanism for suspicious institutional flows | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "compliance" |
| #49 | contracts(compliance): add batch investor whitelisting endpoint for prime broker onboarding | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "compliance" |
| #50 | contracts(compliance): implement proof of institutional authority document attestation | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "compliance" |
| #51 | contracts(compliance): add compliance audit trail event emitter for regulatory oversight | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "compliance" |
| #52 | contracts(compliance): implement tiered transaction volume velocity limits | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "compliance" |
| #53 | contracts(compliance): add delegated compliance checker authorization for prime broker partners | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "compliance" |
| #54 | contracts(compliance): implement dispute resolution arbitration freeze hook | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "compliance" |
| #55 | contracts(compliance): add unit tests verifying unauthorized addresses cannot execute DvP repos | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "compliance" |
| #56 | contracts(compliance): implement SEP-8 action required response codes for institutional compliance | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "compliance" |
| #57 | contracts(compliance): add automated travel rule compliance packet hash logging | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "compliance" |
| #58 | contracts(compliance): implement institutional sub-account management and authorization rules | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "compliance" |
| #59 | contracts(compliance): add compliance policy upgrade voting mechanism | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "compliance" |
| #60 | contracts(compliance): optimize persistent storage layout for KYC investor profiles | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "compliance" |

## Native Fiat Anchor Settlement Rails (20 Issues)

| ID | Title | Complexity | Points | Labels |
| :---: | :--- | :---: | :---: | :--- |
| #61 | contracts(settlement): implement automated SEP-24 interactive deposit URL generator | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "settlement" |
| #62 | contracts(settlement): implement Cowrie Integrated Systems NGN anchor settlement integration | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "settlement" |
| #63 | contracts(settlement): implement Mercado Bitcoin BRL anchor payout integration | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "settlement" |
| #64 | contracts(settlement): implement Tempo France EUR SEPA Instant settlement integration | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "settlement" |
| #65 | contracts(settlement): implement ClickPesa East Africa KES and TZS mobile money payout | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "settlement" |
| #66 | contracts(settlement): add automated proof-of-settlement bank reference matching | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "settlement" |
| #67 | contracts(settlement): implement slippage protection for automated FX conversions on Soroban DEX | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "settlement" |
| #68 | contracts(settlement): add multi-anchor fallback routing for African trade corridors | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "settlement" |
| #69 | contracts(settlement): implement anchor fee estimation and net payout calculation | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "settlement" |
| #70 | contracts(settlement): add webhook notification handler for bank off-ramp status updates | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "settlement" |
| #71 | contracts(settlement): implement anchor liquidity reserve health check poller | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "settlement" |
| #72 | contracts(settlement): add currency support for South African Rand (ZAR) anchor integration | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "settlement" |
| #73 | contracts(settlement): implement emergency refund escrow for failed bank transfers | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "settlement" |
| #74 | contracts(settlement): add fiat anchor API latency and uptime tracking | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "settlement" |
| #75 | contracts(settlement): implement anchor registration approval workflow by protocol governance | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "settlement" |
| #76 | contracts(settlement): add unit tests simulating anchor payout confirmation and dispute handling | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "settlement" |
| #77 | contracts(settlement): implement batch anchor payout dispatch for multi-supplier export contracts | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "settlement" |
| #78 | contracts(settlement): add cryptographic proof validation of anchor banking confirmations | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "settlement" |
| #79 | contracts(settlement): implement local fiat tax and withholding calculation module | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "settlement" |
| #80 | contracts(settlement): optimize settlement contract gas usage during batch anchor dispatches | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "settlement" |

## Oracles, Dynamic Haircuts & Valuation Feeds (20 Issues)

| ID | Title | Complexity | Points | Labels |
| :---: | :--- | :---: | :---: | :--- |
| #81 | contracts(oracles): implement Soroban oracle price feed adapter for tokenized Treasuries | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "oracles" |
| #82 | contracts(oracles): implement TWAP (Time-Weighted Average Price) oracle smoothing | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "oracles" |
| #83 | contracts(oracles): add secondary fallback oracle configuration for Spiko Euro T-Bills | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "oracles" |
| #84 | contracts(oracles): implement dynamic haircut escalation during sovereign credit rating downgrades | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "oracles" |
| #85 | contracts(oracles): add commodity spot price feed integration for export collateral valuation | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "oracles" |
| #86 | contracts(oracles): implement stale price feed detection and automatic repo proposal pause | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "oracles" |
| #87 | contracts(oracles): add medianizer contract aggregating multiple independent price reporters | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "oracles" |
| #88 | contracts(oracles): implement collateral volatility coefficient calculation for margin requirements | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "oracles" |
| #89 | contracts(oracles): add oracle signature verification for off-chain signed price attestations | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "oracles" |
| #90 | contracts(oracles): implement currency exchange rate oracle for EUR/USD and EM fiat pairs | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "oracles" |
| #91 | contracts(oracles): add deviation threshold circuit breaker to prevent flash loan exploits | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "oracles" |
| #92 | contracts(oracles): implement oracle heartbeat monitoring and keeper reward incentives | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "oracles" |
| #93 | contracts(oracles): add unit tests simulating oracle failure modes and recovery procedures | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "oracles" |
| #94 | contracts(oracles): implement historical price volatility archival on Soroban ledger | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "oracles" |
| #95 | contracts(oracles): add support for yield curve discount factor calculations in bond pricing | **High** | 200 Pts | "Stellar Wave", "High", "contracts", "oracles" |
| #96 | contracts(oracles): implement oracle admin key rotation and emergency feed replacement | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "oracles" |
| #97 | contracts(oracles): add gas optimization for oracle consumer contracts | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "oracles" |
| #98 | contracts(oracles): implement stress testing harness for oracle feed resilience | **Medium** | 150 Pts | "Stellar Wave", "Medium", "contracts", "oracles" |
| #99 | contracts(oracles): add automated alert webhooks for extreme oracle price deviations | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "oracles" |
| #100 | contracts(oracles): document oracle security assumptions and threat model in protocol specs | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "contracts", "oracles" |

## TypeScript SDK & Financial Math Modeling (20 Issues)

| ID | Title | Complexity | Points | Labels |
| :---: | :--- | :---: | :---: | :--- |
| #101 | sdk(sdk): implement exact basis point repo interest calculation module | **High** | 200 Pts | "Stellar Wave", "High", "sdk", "sdk" |
| #102 | sdk(sdk): implement tranche waterfall simulation engine with loss distribution curves | **High** | 200 Pts | "Stellar Wave", "High", "sdk", "sdk" |
| #103 | sdk(sdk): add automated Soroban transaction envelope builder for DvP execution | **High** | 200 Pts | "Stellar Wave", "High", "sdk", "sdk" |
| #104 | sdk(sdk): implement institutional portfolio risk metrics calculator (VaR and LTV) | **High** | 200 Pts | "Stellar Wave", "High", "sdk", "sdk" |
| #105 | sdk(sdk): add comprehensive TypeScript types for all Soroban contract XDR structs | **Medium** | 150 Pts | "Stellar Wave", "Medium", "sdk", "sdk" |
| #106 | sdk(sdk): implement client-side haircut estimator for diverse sovereign bond types | **Medium** | 150 Pts | "Stellar Wave", "Medium", "sdk", "sdk" |
| #107 | sdk(sdk): add SEP-24 interactive off-ramp URL constructor and parameter signer | **Medium** | 150 Pts | "Stellar Wave", "Medium", "sdk", "sdk" |
| #108 | sdk(sdk): implement automated RPC retry and exponential backoff handler for Soroban RPC | **Medium** | 150 Pts | "Stellar Wave", "Medium", "sdk", "sdk" |
| #109 | sdk(sdk): add multi-wallet connector support for Freighter, Albedo, and Ledger | **High** | 200 Pts | "Stellar Wave", "High", "sdk", "sdk" |
| #110 | sdk(sdk): implement bond yield-to-maturity (YTM) and duration calculator | **Medium** | 150 Pts | "Stellar Wave", "Medium", "sdk", "sdk" |
| #111 | sdk(sdk): add export invoice validation and metadata formatting utilities | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "sdk", "sdk" |
| #112 | sdk(sdk): implement mock test environment for local SDK development without live RPC | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "sdk", "sdk" |
| #113 | sdk(sdk): add automated test suite covering all SDK math calculations | **Medium** | 150 Pts | "Stellar Wave", "Medium", "sdk", "sdk" |
| #114 | sdk(sdk): implement CLI tool for institutional treasury desks to query repo rates | **Medium** | 150 Pts | "Stellar Wave", "Medium", "sdk", "sdk" |
| #115 | sdk(sdk): add event stream listener for real-time repo and credit contract updates | **High** | 200 Pts | "Stellar Wave", "High", "sdk", "sdk" |
| #116 | sdk(sdk): implement currency conversion helper using Stellar DEX order book liquidity | **Medium** | 150 Pts | "Stellar Wave", "Medium", "sdk", "sdk" |
| #117 | sdk(sdk): add comprehensive SDK API reference documentation with typedoc | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "sdk", "sdk" |
| #118 | sdk(sdk): implement bundle size optimization and tree-shaking support | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "sdk", "sdk" |
| #119 | sdk(sdk): add stress-testing scripts for high-frequency repo quote querying | **Medium** | 150 Pts | "Stellar Wave", "Medium", "sdk", "sdk" |
| #120 | sdk(sdk): publish typed npm package configuration for institutional monorepo consumption | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "sdk", "sdk" |

## Margin Watcher & Liquidator Daemon (20 Issues)

| ID | Title | Complexity | Points | Labels |
| :---: | :--- | :---: | :---: | :--- |
| #121 | watcher(watcher): implement automated collateral price polling loop with configurable intervals | **High** | 200 Pts | "Stellar Wave", "High", "watcher", "watcher" |
| #122 | watcher(watcher): implement atomic liquidation transaction generator for defaulted repos | **High** | 200 Pts | "Stellar Wave", "High", "watcher", "watcher" |
| #123 | watcher(watcher): add margin call alert notification dispatcher via Telegram and Discord webhooks | **Medium** | 150 Pts | "Stellar Wave", "Medium", "watcher", "watcher" |
| #124 | watcher(watcher): implement gas fee dynamic bidding for high-priority liquidation transactions | **High** | 200 Pts | "Stellar Wave", "High", "watcher", "watcher" |
| #125 | watcher(watcher): add multi-RPC endpoint failover and health monitor for watcher daemon | **Medium** | 150 Pts | "Stellar Wave", "Medium", "watcher", "watcher" |
| #126 | watcher(watcher): implement local SQLite / Redis state cache for fast active repo lookup | **Medium** | 150 Pts | "Stellar Wave", "Medium", "watcher", "watcher" |
| #127 | watcher(watcher): add automated private key management supporting AWS KMS and Vault | **High** | 200 Pts | "Stellar Wave", "High", "watcher", "watcher" |
| #128 | watcher(watcher): implement profit calculation and gas profitability threshold checker | **Medium** | 150 Pts | "Stellar Wave", "Medium", "watcher", "watcher" |
| #129 | watcher(watcher): add Prometheus metrics exporter for liquidator daemon performance tracking | **Medium** | 150 Pts | "Stellar Wave", "Medium", "watcher", "watcher" |
| #130 | watcher(watcher): implement dry-run simulation mode for testing liquidator daemon locally | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "watcher", "watcher" |
| #131 | watcher(watcher): add comprehensive unit test suite for margin call detection logic | **Medium** | 150 Pts | "Stellar Wave", "Medium", "watcher", "watcher" |
| #132 | watcher(watcher): implement Docker containerization and Docker Compose setup for watcher service | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "watcher", "watcher" |
| #133 | watcher(watcher): add rate limiting and deduplication for margin call notifications | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "watcher", "watcher" |
| #134 | watcher(watcher): implement automated ledger sequence number sync and transaction queueing | **High** | 200 Pts | "Stellar Wave", "High", "watcher", "watcher" |
| #135 | watcher(watcher): add institutional custody multi-sig notification integration | **Medium** | 150 Pts | "Stellar Wave", "Medium", "watcher", "watcher" |
| #136 | watcher(watcher): implement Graceful shutdown and signal handling for daemon process | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "watcher", "watcher" |
| #137 | watcher(watcher): add health-check HTTP endpoint for Kubernetes liveness and readiness probes | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "watcher", "watcher" |
| #138 | watcher(watcher): implement structured JSON logging with correlation IDs for auditability | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "watcher", "watcher" |
| #139 | watcher(watcher): add automated test harness verifying liquidation execution on Soroban local sandbox | **High** | 200 Pts | "Stellar Wave", "High", "watcher", "watcher" |
| #140 | watcher(watcher): document liquidator bot deployment guide and institutional SLA recommendations | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "watcher", "watcher" |

## Institutional Web Portal & Risk Analytics (20 Issues)

| ID | Title | Complexity | Points | Labels |
| :---: | :--- | :---: | :---: | :--- |
| #141 | web(web): implement interactive bilateral repo quote calculator with slider controls | **High** | 200 Pts | "Stellar Wave", "High", "web", "web" |
| #142 | web(web): implement senior/junior tranche investment modal with transaction signing | **High** | 200 Pts | "Stellar Wave", "High", "web", "web" |
| #143 | web(web): add real-time collateral margin health gauge with color-coded risk bands | **Medium** | 150 Pts | "Stellar Wave", "Medium", "web", "web" |
| #144 | web(web): implement emerging market trade invoice viewer with IPFS document preview | **Medium** | 150 Pts | "Stellar Wave", "Medium", "web", "web" |
| #145 | web(web): add SEP-24 interactive fiat payout drawer for emerging market exporters | **High** | 200 Pts | "Stellar Wave", "High", "web", "web" |
| #146 | web(web): implement institutional portfolio dashboard tracking active repos and credit positions | **High** | 200 Pts | "Stellar Wave", "High", "web", "web" |
| #147 | web(web): add historical repo rate chart comparing Aegis rates vs SOFR and EURIBOR benchmarks | **Medium** | 150 Pts | "Stellar Wave", "Medium", "web", "web" |
| #148 | web(web): implement multi-currency balance switcher displaying values in USD, EUR, and local fiat | **Medium** | 150 Pts | "Stellar Wave", "Medium", "web", "web" |
| #149 | web(web): add institutional KYC verification status badge with SEP-8 tier indicator | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "web", "web" |
| #150 | web(web): implement dark institutional terminal UI theme with high-contrast accessibility | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "web", "web" |
| #151 | web(web): add responsive mobile view optimization for executive tablet and phone review | **Medium** | 150 Pts | "Stellar Wave", "Medium", "web", "web" |
| #152 | web(web): implement transaction receipt modal with Stellar Expert explorer deep-links | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "web", "web" |
| #153 | web(web): add export facility search, filter, and sorting by country, commodity, and APR | **Medium** | 150 Pts | "Stellar Wave", "Medium", "web", "web" |
| #154 | web(web): implement CSV and PDF report export for institutional accounting and tax reconciliation | **Medium** | 150 Pts | "Stellar Wave", "Medium", "web", "web" |
| #155 | web(web): add wallet disconnection and network switching handler (Mainnet / Testnet) | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "web", "web" |
| #156 | web(web): implement toast notification system for real-time transaction lifecycle feedback | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "web", "web" |
| #157 | web(web): add error boundary and fallback UI components for network degradation | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "web", "web" |
| #158 | web(web): implement SEO metadata and OpenGraph social card previews for Drips Wave | **Trivial** | 100 Pts | "Stellar Wave", "Trivial", "web", "web" |
| #159 | web(web): add end-to-end Cypress / Playwright test suite for web application flows | **High** | 200 Pts | "Stellar Wave", "High", "web", "web" |
| #160 | web(web): optimize web application Lighthouse performance and Core Web Vitals to 95+ | **Medium** | 150 Pts | "Stellar Wave", "Medium", "web", "web" |

