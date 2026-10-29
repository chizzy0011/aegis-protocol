$categories = @(
    @{
        name = "Bilateral Repo & DvP Clearing Engine"
        tag = "contracts"
        subtag = "repo"
        items = @(
            @("implement open-term repo rollover with dynamic rate reset", "High", 200, "Add automated rollover mechanics where borrower and lender can extend open-term repo positions without unwinding underlying collateral escrow."),
            @("implement dynamic haircut adjustment based on collateral volatility", "High", 200, "Integrate historical price volatility models into the repo engine to adjust collateral haircut percentages dynamically."),
            @("add partial collateral substitution mechanism during active repo term", "High", 200, "Allow institutional borrowers to replace pledged sovereign debt collateral with equivalent eligible securities of identical credit rating."),
            @("implement tri-party custodian agent authorization role", "Medium", 150, "Add third-party collateral agent roles capable of verifying settlement compliance and releasing escrow."),
            @("add multi-currency repo settlement support for EURC and USDC", "Medium", 150, "Support dual cash settlement in both Circle EURC and USDC for European sovereign debt repos."),
            @("implement grace period countdown timer for margin call remediations", "Medium", 150, "Introduce a configurable grace period ledger timestamp before collateral liquidation is authorized."),
            @("add tiered repo rate discount curves based on borrower credit rating", "Medium", 150, "Incorporate credit-tier adjustments that discount standard benchmark repo rates for AAA-rated institutional desks."),
            @("implement early termination settlement penalty calculation", "Medium", 150, "Calculate accrued interest and early unwinding fees if a borrower settles a fixed-term repo before scheduled maturity."),
            @("add batch DvP execution endpoint for institutional portfolio rebalancing", "High", 200, "Enable settlement of multiple bilateral repo agreements within a single atomic Soroban transaction envelope."),
            @("implement automated collateral yield pass-through to original borrower", "High", 200, "Ensure coupon payments and native tokenized bond yields accruing during repo terms are credited to the borrower."),
            @("add minimum and maximum term bounds validation to repo proposals", "Trivial", 100, "Enforce protocol-level minimum (1 hour) and maximum (365 days) duration checks on proposed repo agreements."),
            @("implement emergency pause and circuit breaker for repo clearing engine", "Medium", 150, "Allow authorized risk multisig to pause new repo matching during extreme macro depeg events."),
            @("add event emission for all DvP state transitions", "Trivial", 100, "Emit typed Soroban events for RepoProposed, DvPExecuted, Repurchased, and DefaultLiquidated."),
            @("implement repo position transferability for secondary market participation", "High", 200, "Allow lenders to sell active repo promissory claims to other accredited institutional liquidity providers."),
            @("add protocol reserve fee deduction on repo interest settlements", "Trivial", 100, "Deduct a protocol reserve fee (e.g. 5 bps) from accrued repo interest to fund protocol safety module."),
            @("implement collateral rehypothecation limits and tracking", "High", 200, "Track on-chain rehypothecation status to guarantee institutional collateral is never double-pledged."),
            @("add comprehensive fuzz testing for repo haircut calculations", "Medium", 150, "Implement property-based fuzz tests to guarantee zero integer overflow in basis point math."),
            @("implement borrower default insurance fund waterfall integration", "High", 200, "Route residual liquidation shortfalls to the Aegis Safety Reserve when collateral liquidations execute below par."),
            @("add audit logging of borrower historical repo repayment performance", "Medium", 150, "Store on-chain credit scores reflecting on-time repurchase settlement track records."),
            @("optimize Soroban storage footprint for closed repo agreements", "Trivial", 100, "Archive completed repo records using Soroban temporary storage or TTL pruning to minimize ledger rent.")
        )
    },
    @{
        name = "Structured Trade Credit & Tranche Waterfall"
        tag = "contracts"
        subtag = "credit"
        items = @(
            @("implement automated senior tranche first-loss capital protection logic", "High", 200, "Ensure junior tranche capital is depleted 100% before senior tranche depositors experience any principal impairment."),
            @("implement dynamic tranche ratio adjustments based on invoice risk grade", "High", 200, "Allow underwriter to customize senior/junior ratios (70/30 to 90/10) based on off-taker credit ratings."),
            @("add invoice factoring bill-of-lading verification oracle hook", "High", 200, "Verify customs declaration and digital bill-of-lading hashes before credit facility fundraising opens."),
            @("implement revolving credit facility mechanics for established exporters", "High", 200, "Allow recurring commodity exporters to draw down capital repeatedly against rolling receivables."),
            @("add multi-investor pro-rata tranche yield distribution claims", "Medium", 150, "Distribute repayments proportionally to liquidity providers based on their share of the senior/junior tranche."),
            @("implement early repayment discount incentive for trade borrowers", "Medium", 150, "Reduce total interest payable if export off-taker settles invoices prior to the 90-day due date."),
            @("add penalty interest accrual for past-due invoice facilities", "Medium", 150, "Accrue a 250 bps penalty rate automatically if facility remains active past the due timestamp."),
            @("implement underwriter skin-in-the-game co-investment requirement", "Medium", 150, "Require originating factoring partners to supply at least 5% of the junior equity tranche."),
            @("add emergency debt restructuring and term extension vote", "High", 200, "Allow senior and junior token holders to vote on restructuring repayment terms during logistics delays."),
            @("implement automated currency hedging reserve for non-USD off-takers", "High", 200, "Deduct FX variance buffers when export contracts are denominated in non-dollar fiat."),
            @("add minimum ticket size validation for accredited tranche investors", "Trivial", 100, "Enforce $5,000 minimum deposit thresholds for institutional trade credit participation."),
            @("implement typed event logging for all credit tranche state transitions", "Trivial", 100, "Emit FacilityCreated, TrancheFunded, DrawdownExecuted, and Repaid events."),
            @("add facility documentation IPFS hash immutability verification", "Trivial", 100, "Verify SHA-256 integrity hash of export invoices and phytosanitary certificates stored on IPFS."),
            @("implement off-taker rating agency cross-reference verification", "Medium", 150, "Cross-reference buyer Dun & Bradstreet / Moody credit ratings against underwriter proposals."),
            @("add secondary liquidity market for senior tranche receipt tokens", "High", 200, "Issue yield-bearing SEP-41 receipt tokens for senior tranche deposits to enable secondary liquidity."),
            @("implement automated bad debt write-off protocol workflow", "Medium", 150, "Define governance-approved default declaration procedure after 180 days past due."),
            @("add collateralized export inventory warehouse receipt integration", "High", 200, "Pledge certified warehouse commodity receipts as secondary collateral for trade finance facilities."),
            @("implement tranche yield auto-compounding vault option", "Medium", 150, "Allow senior tranche depositors to auto-reinvest principal and interest into subsequent export pools."),
            @("add comprehensive unit test suite for tranche waterfall liquidation", "Medium", 150, "Write tests simulating complete and partial defaults across varied senior/junior tranche ratios."),
            @("optimize ledger footprint of matured trade credit agreements", "Trivial", 100, "Prune expired facility storage entries while archiving critical audit trails.")
        )
    },
    @{
        name = "Institutional Compliance & SEP-8 Gates"
        tag = "contracts"
        subtag = "compliance"
        items = @(
            @("implement automated sanctions screening list sync for OFAC and EU lists", "High", 200, "Sync on-chain blacklist mapping with updated international sanctions lists."),
            @("implement jurisdiction restriction matrix for US and FATF high-risk countries", "High", 200, "Block transfer authorization for addresses associated with non-compliant jurisdictions."),
            @("add accredited investor annual recertification countdown", "Medium", 150, "Enforce annual KYC expiry timestamps and notify institutions 30 days prior to expiry."),
            @("implement role-based compliance officer multi-signature authorization", "Medium", 150, "Require 2-of-3 compliance multisig signatures to upgrade investor tiers or unblock accounts."),
            @("add SEP-8 transfer approval check for secondary tranche token transfers", "High", 200, "Verify both sender and recipient hold valid institutional KYC credentials before allowing bond transfers."),
            @("implement zero-knowledge KYC proof verification hook", "High", 200, "Verify zk-attestation proofs allowing institutions to prove accreditation without leaking identity on-chain."),
            @("add entity type tagging for bank, fund, corporate treasury, and sovereign wealth", "Trivial", 100, "Tag institutional profiles with specific institutional classifications for regulatory reporting."),
            @("implement temporary freeze mechanism for suspicious institutional flows", "Medium", 150, "Allow compliance admins to freeze specific wallet interactions pending AML review."),
            @("add batch investor whitelisting endpoint for prime broker onboarding", "Medium", 150, "Enable single-transaction onboarding of up to 50 institutional client addresses."),
            @("implement proof of institutional authority document attestation", "Medium", 150, "Store cryptographic hashes of corporate resolutions and authorized signatory registers."),
            @("add compliance audit trail event emitter for regulatory oversight", "Trivial", 100, "Emit detailed compliance audit events for all tier upgrades, revocations, and sanction flags."),
            @("implement tiered transaction volume velocity limits", "Medium", 150, "Enforce daily and monthly transaction limits based on institutional tier verification levels."),
            @("add delegated compliance checker authorization for prime broker partners", "High", 200, "Allow authorized institutional broker-dealers to manage whitelisting for their sub-accounts."),
            @("implement dispute resolution arbitration freeze hook", "Medium", 150, "Hold collateral in neutral escrow during active bilateral commercial dispute arbitration."),
            @("add unit tests verifying unauthorized addresses cannot execute DvP repos", "Trivial", 100, "Test contract rejection when non-whitelisted addresses attempt to borrow or lend."),
            @("implement SEP-8 action required response codes for institutional compliance", "Medium", 150, "Return standardized SEP-8 error codes instructing users on required KYC actions."),
            @("add automated travel rule compliance packet hash logging", "High", 200, "Log cryptographic commitment hashes for IVMS 101 messaging between virtual asset service providers."),
            @("implement institutional sub-account management and authorization rules", "Medium", 150, "Allow parent fund entities to authorize specific trader and custodian wallet sub-keys."),
            @("add compliance policy upgrade voting mechanism", "High", 200, "Allow protocol governance to approve updates to compliance policy rulesets."),
            @("optimize persistent storage layout for KYC investor profiles", "Trivial", 100, "Pack investor metadata into compact bitfields to minimize Soroban instance storage fees.")
        )
    },
    @{
        name = "Native Fiat Anchor Settlement Rails"
        tag = "contracts"
        subtag = "settlement"
        items = @(
            @("implement automated SEP-24 interactive deposit URL generator", "High", 200, "Generate signed interactive SEP-24 URLs for frictionless bank transfers in Nigeria, Brazil, and Europe."),
            @("implement Cowrie Integrated Systems NGN anchor settlement integration", "High", 200, "Connect funded export pools directly to Cowrie NGN rails for instant Nigerian bank payouts."),
            @("implement Mercado Bitcoin BRL anchor payout integration", "High", 200, "Connect agricultural facilities to Mercado Bitcoin PIX rails for instant Brazilian Real disbursement."),
            @("implement Tempo France EUR SEPA Instant settlement integration", "High", 200, "Route European sovereign debt repo settlements and exporter payouts via Tempo SEPA Instant."),
            @("implement ClickPesa East Africa KES and TZS mobile money payout", "High", 200, "Integrate M-Pesa and bank payout dispatch for Kenyan horticulture exporters via ClickPesa."),
            @("add automated proof-of-settlement bank reference matching", "Medium", 150, "Match banking settlement transaction references against on-chain facility settlement IDs."),
            @("implement slippage protection for automated FX conversions on Soroban DEX", "Medium", 150, "Enforce maximum slippage tolerances when converting off-taker fiat payments back to USDC."),
            @("add multi-anchor fallback routing for African trade corridors", "High", 200, "Automatically route payments to secondary licensed anchors if primary anchor experiences downtime."),
            @("implement anchor fee estimation and net payout calculation", "Medium", 150, "Calculate local banking rail transfer fees and display net funds received by the exporter."),
            @("add webhook notification handler for bank off-ramp status updates", "Medium", 150, "Process webhook confirmations from anchor APIs to trigger on-chain settlement confirmation."),
            @("implement anchor liquidity reserve health check poller", "Medium", 150, "Verify anchor hot wallets have sufficient fiat and token liquidity before dispatching large payouts."),
            @("add currency support for South African Rand (ZAR) anchor integration", "Medium", 150, "Expand anchor registry to support tokenized ZAR for Southern African commodity trade."),
            @("implement emergency refund escrow for failed bank transfers", "High", 200, "Return capital to loan contract escrow if local bank account details are rejected."),
            @("add fiat anchor API latency and uptime tracking", "Trivial", 100, "Track anchor confirmation response times to select fastest execution paths."),
            @("implement anchor registration approval workflow by protocol governance", "Medium", 150, "Require community governance vote to register new fiat anchor partners."),
            @("add unit tests simulating anchor payout confirmation and dispute handling", "Trivial", 100, "Write tests for contract state transitions during anchor dispatch and confirmation."),
            @("implement batch anchor payout dispatch for multi-supplier export contracts", "High", 200, "Split facility disbursements across multiple supplier bank accounts in a single atomic transaction."),
            @("add cryptographic proof validation of anchor banking confirmations", "High", 200, "Verify Ed25519 digital signatures on anchor settlement receipt payloads."),
            @("implement local fiat tax and withholding calculation module", "Medium", 150, "Estimate local statutory withholding taxes on cross-border agricultural export financing."),
            @("optimize settlement contract gas usage during batch anchor dispatches", "Trivial", 100, "Minimize Soroban CPU and memory instructions in anchor dispatch functions.")
        )
    },
    @{
        name = "Oracles, Dynamic Haircuts & Valuation Feeds"
        tag = "contracts"
        subtag = "oracles"
        items = @(
            @("implement Soroban oracle price feed adapter for tokenized Treasuries", "High", 200, "Integrate decentralized oracle feeds tracking secondary market NAV of Spiko, BENJI, and WisdomTree."),
            @("implement TWAP (Time-Weighted Average Price) oracle smoothing", "High", 200, "Compute 24-hour TWAP to protect repo haircut calculations from flash crashes and oracle anomalies."),
            @("add secondary fallback oracle configuration for Spiko Euro T-Bills", "Medium", 150, "Configure fallback data source if primary pricing oracle fails to update within heartbeat interval."),
            @("implement dynamic haircut escalation during sovereign credit rating downgrades", "High", 200, "Automatically increase haircut requirements if sovereign credit ratings drop below threshold."),
            @("add commodity spot price feed integration for export collateral valuation", "High", 200, "Track London / New York commodity exchange spot prices for cocoa, coffee, and soya beans."),
            @("implement stale price feed detection and automatic repo proposal pause", "Medium", 150, "Reject new repo proposals if oracle price feed heartbeat exceeds 3,600 seconds."),
            @("add medianizer contract aggregating multiple independent price reporters", "High", 200, "Aggregate feeds from 3 independent institutional price nodes using median filtering."),
            @("implement collateral volatility coefficient calculation for margin requirements", "Medium", 150, "Calculate rolling 30-day standard deviation to inform maintenance margin thresholds."),
            @("add oracle signature verification for off-chain signed price attestations", "High", 200, "Verify cryptographic signatures on off-chain price payloads before applying valuations."),
            @("implement currency exchange rate oracle for EUR/USD and EM fiat pairs", "Medium", 150, "Track real-time FX rates to evaluate multi-currency collateral and debt positions."),
            @("add deviation threshold circuit breaker to prevent flash loan exploits", "Medium", 150, "Reject oracle price updates that deviate by more than 5% from previous round."),
            @("implement oracle heartbeat monitoring and keeper reward incentives", "Trivial", 100, "Reward keeper bots in XLM for maintaining timely price feed updates on Soroban."),
            @("add unit tests simulating oracle failure modes and recovery procedures", "Trivial", 100, "Test contract behavior under oracle stale prices, zero prices, and extreme volatility."),
            @("implement historical price volatility archival on Soroban ledger", "Medium", 150, "Maintain rolling window of price observations for risk engine analysis."),
            @("add support for yield curve discount factor calculations in bond pricing", "High", 200, "Discount future bond cash flows using SOFR and EURIBOR benchmark interest rate curves."),
            @("implement oracle admin key rotation and emergency feed replacement", "Medium", 150, "Allow protocol security committee to rotate oracle reporter keys in case of compromise."),
            @("add gas optimization for oracle consumer contracts", "Trivial", 100, "Cache oracle values within single transaction context to avoid duplicate read overhead."),
            @("implement stress testing harness for oracle feed resilience", "Medium", 150, "Create simulation suite testing repo liquidations under historical 2008 and 2020 market shocks."),
            @("add automated alert webhooks for extreme oracle price deviations", "Trivial", 100, "Emit alerts to monitoring infrastructure when asset prices fluctuate significantly."),
            @("document oracle security assumptions and threat model in protocol specs", "Trivial", 100, "Write detailed technical specification of oracle trust assumptions and failure boundaries.")
        )
    },
    @{
        name = "TypeScript SDK & Financial Math Modeling"
        tag = "sdk"
        subtag = "sdk"
        items = @(
            @("implement exact basis point repo interest calculation module", "High", 200, "Build high-precision BigNumber calculation library for annual repo rates and cost of carry."),
            @("implement tranche waterfall simulation engine with loss distribution curves", "High", 200, "Simulate expected yield, default impact, and recovery rates across senior/junior tranches."),
            @("add automated Soroban transaction envelope builder for DvP execution", "High", 200, "Construct and sign complete Soroban transaction envelopes for bilateral repo agreements."),
            @("implement institutional portfolio risk metrics calculator (VaR and LTV)", "High", 200, "Calculate Value-at-Risk (VaR), portfolio Loan-to-Value (LTV), and margin call headroom."),
            @("add comprehensive TypeScript types for all Soroban contract XDR structs", "Medium", 150, "Export fully-typed interfaces for RepoAgreement, CreditFacility, and InvestorProfile."),
            @("implement client-side haircut estimator for diverse sovereign bond types", "Medium", 150, "Estimate required haircuts based on maturity, rating, and collateral liquidity profile."),
            @("add SEP-24 interactive off-ramp URL constructor and parameter signer", "Medium", 150, "Build helper utilities to generate signed SEP-24 interactive deposit and withdrawal links."),
            @("implement automated RPC retry and exponential backoff handler for Soroban RPC", "Medium", 150, "Handle rate limiting and network drops gracefully in institutional SDK client."),
            @("add multi-wallet connector support for Freighter, Albedo, and Ledger", "High", 200, "Support institutional hardware wallets and browser extensions seamlessly."),
            @("implement bond yield-to-maturity (YTM) and duration calculator", "Medium", 150, "Calculate Macaulay duration and modified duration for pledged tokenized bonds."),
            @("add export invoice validation and metadata formatting utilities", "Trivial", 100, "Validate invoice fields, currency codes, and counterparty metadata prior to submission."),
            @("implement mock test environment for local SDK development without live RPC", "Trivial", 100, "Provide mock fixtures for repo quotes, credit facilities, and anchor settlements."),
            @("add automated test suite covering all SDK math calculations", "Medium", 150, "Write unit tests verifying math parity between Rust contracts and TypeScript SDK."),
            @("implement CLI tool for institutional treasury desks to query repo rates", "Medium", 150, "Build `aegis-cli` command-line utility for rapid repo quotes and facility inspections."),
            @("add event stream listener for real-time repo and credit contract updates", "High", 200, "Subscribe to Soroban RPC event streams and emit typed EventEmitter notifications."),
            @("implement currency conversion helper using Stellar DEX order book liquidity", "Medium", 150, "Estimate effective FX execution rates across Stellar anchor trading pairs."),
            @("add comprehensive SDK API reference documentation with typedoc", "Trivial", 100, "Generate complete HTML and Markdown documentation for all exported SDK functions."),
            @("implement bundle size optimization and tree-shaking support", "Trivial", 100, "Configure build tooling to ensure minimal bundle footprint for web and mobile clients."),
            @("add stress-testing scripts for high-frequency repo quote querying", "Medium", 150, "Test SDK throughput under 1,000 concurrent quote requests per minute."),
            @("publish typed npm package configuration for institutional monorepo consumption", "Trivial", 100, "Ensure ESM and CommonJS dual-module resolution compatibility across all environments.")
        )
    },
    @{
        name = "Margin Watcher & Liquidator Daemon"
        tag = "watcher"
        subtag = "watcher"
        items = @(
            @("implement automated collateral price polling loop with configurable intervals", "High", 200, "Poll Soroban RPC and oracle feeds continuously to verify active repo collateral health."),
            @("implement atomic liquidation transaction generator for defaulted repos", "High", 200, "Construct and broadcast atomic liquidation envelopes immediately upon grace period expiry."),
            @("add margin call alert notification dispatcher via Telegram and Discord webhooks", "Medium", 150, "Send automated notifications to institutional borrowers when LTV approaches haircut threshold."),
            @("implement gas fee dynamic bidding for high-priority liquidation transactions", "High", 200, "Adjust Stellar transaction inclusion fees dynamically to ensure rapid inclusion in next ledger."),
            @("add multi-RPC endpoint failover and health monitor for watcher daemon", "Medium", 150, "Switch to backup Soroban RPC nodes automatically if primary provider experiences latency."),
            @("implement local SQLite / Redis state cache for fast active repo lookup", "Medium", 150, "Cache on-chain positions locally to eliminate redundant full-ledger scanning."),
            @("add automated private key management supporting AWS KMS and Vault", "High", 200, "Secure liquidator bot signing keys using enterprise cloud key management services."),
            @("implement profit calculation and gas profitability threshold checker", "Medium", 150, "Ensure liquidation incentives exceed network fees before submitting execution envelopes."),
            @("add Prometheus metrics exporter for liquidator daemon performance tracking", "Medium", 150, "Export metrics for active repos monitored, liquidations triggered, and RPC latency."),
            @("implement dry-run simulation mode for testing liquidator daemon locally", "Trivial", 100, "Allow running watcher daemon in read-only mode without broadcasting transactions."),
            @("add comprehensive unit test suite for margin call detection logic", "Medium", 150, "Test edge cases where collateral price drops suddenly by 10%, 20%, and 50%."),
            @("implement Docker containerization and Docker Compose setup for watcher service", "Trivial", 100, "Package margin watcher daemon with automated restart policies for production deployment."),
            @("add rate limiting and deduplication for margin call notifications", "Trivial", 100, "Prevent spamming institutional borrowers with duplicate alerts within a 1-hour window."),
            @("implement automated ledger sequence number sync and transaction queueing", "High", 200, "Manage Stellar source account sequence numbers correctly during concurrent liquidations."),
            @("add institutional custody multi-sig notification integration", "Medium", 150, "Notify institutional custodian multisigs when collateral release approvals are ready."),
            @("implement Graceful shutdown and signal handling for daemon process", "Trivial", 100, "Handle SIGINT and SIGTERM cleanly without leaving pending transactions in ambiguous states."),
            @("add health-check HTTP endpoint for Kubernetes liveness and readiness probes", "Trivial", 100, "Expose `/healthz` and `/readyz` endpoints returning daemon operational status."),
            @("implement structured JSON logging with correlation IDs for auditability", "Trivial", 100, "Format all daemon logs with Winston / Pino including correlation IDs for incident response."),
            @("add automated test harness verifying liquidation execution on Soroban local sandbox", "High", 200, "Run end-to-end integration tests on local Soroban sandbox simulating default liquidations."),
            @("document liquidator bot deployment guide and institutional SLA recommendations", "Trivial", 100, "Write step-by-step documentation for institutions running their own liquidator nodes.")
        )
    },
    @{
        name = "Institutional Web Portal & Risk Analytics"
        tag = "web"
        subtag = "web"
        items = @(
            @("implement interactive bilateral repo quote calculator with slider controls", "High", 200, "Build real-time interactive calculator showing borrowing capacity and interest as user adjusts sliders."),
            @("implement senior/junior tranche investment modal with transaction signing", "High", 200, "Enable 1-click deposit into trade credit tranches using Freighter or MetaMask."),
            @("add real-time collateral margin health gauge with color-coded risk bands", "Medium", 150, "Display visual gauge showing distance to margin call (Safe: Green, Warning: Yellow, Critical: Red)."),
            @("implement emerging market trade invoice viewer with IPFS document preview", "Medium", 150, "Display verified export invoices, bills of lading, and inspection certificates in a clean modal."),
            @("add SEP-24 interactive fiat payout drawer for emerging market exporters", "High", 200, "Embed native Stellar fiat anchor off-ramp interface directly in the application flow."),
            @("implement institutional portfolio dashboard tracking active repos and credit positions", "High", 200, "Provide consolidated overview of pledged collateral, active debt, and earned tranche yield."),
            @("add historical repo rate chart comparing Aegis rates vs SOFR and EURIBOR benchmarks", "Medium", 150, "Chart historical protocol repo rates against traditional benchmark interest rates."),
            @("implement multi-currency balance switcher displaying values in USD, EUR, and local fiat", "Medium", 150, "Allow institutional users to toggle portfolio valuation across USD, EUR, NGN, and BRL."),
            @("add institutional KYC verification status badge with SEP-8 tier indicator", "Trivial", 100, "Display accredited investor badge and verification expiry date in user profile header."),
            @("implement dark institutional terminal UI theme with high-contrast accessibility", "Trivial", 100, "Refine color palette and typography following institutional Bloomberg/terminal aesthetics."),
            @("add responsive mobile view optimization for executive tablet and phone review", "Medium", 150, "Ensure all repo cards, tranche progress bars, and modals render cleanly on mobile viewports."),
            @("implement transaction receipt modal with Stellar Expert explorer deep-links", "Trivial", 100, "Display clean confirmation modal with direct links to Stellar Expert ledger transactions."),
            @("add export facility search, filter, and sorting by country, commodity, and APR", "Medium", 150, "Allow investors to filter trade credit pools by country (Nigeria, Brazil, Kenya) and commodity."),
            @("implement CSV and PDF report export for institutional accounting and tax reconciliation", "Medium", 150, "Generate downloadable audit reports of all repo interest payments and tranche dividends."),
            @("add wallet disconnection and network switching handler (Mainnet / Testnet)", "Trivial", 100, "Support switching between Stellar Public Network and Testnet with clear UI warnings."),
            @("implement toast notification system for real-time transaction lifecycle feedback", "Trivial", 100, "Display non-intrusive toast alerts for transaction submission, ledger inclusion, and errors."),
            @("add error boundary and fallback UI components for network degradation", "Trivial", 100, "Render graceful fallback error screens when Soroban RPC or indexer is unreachable."),
            @("implement SEO metadata and OpenGraph social card previews for Drips Wave", "Trivial", 100, "Configure rich preview metadata for Twitter/X, Discord, and GitHub sharing."),
            @("add end-to-end Cypress / Playwright test suite for web application flows", "High", 200, "Test full user journey: connecting wallet, requesting repo quote, and depositing into tranche."),
            @("optimize web application Lighthouse performance and Core Web Vitals to 95+", "Medium", 150, "Optimize image assets, dynamic imports, and bundle chunking for sub-second load times.")
        )
    }
)

$issues = @()
$counter = 1

foreach ($cat in $categories) {
    foreach ($item in $cat.items) {
        $titleSuffix = $item[0]
        $diff = $item[1]
        $pts = $item[2]
        $desc = $item[3]

        $title = "$($cat.tag)($($cat.subtag)): $titleSuffix"
        $body = @"
### User Story / Objective
As an institutional participant in the Aegis Protocol on Stellar Soroban, I need to $titleSuffix so that the protocol maintains institutional-grade collateral clearing, robust risk boundaries, and seamless cross-border settlement.

### Technical Specification & Context
$desc

### Detailed Acceptance Criteria
- [ ] Implementation must adhere to strict Soroban SDK 22 patterns and safe arithmetic conventions.
- [ ] Full unit test coverage covering both happy paths and edge cases (e.g. boundary conditions, zero values, error codes).
- [ ] Clean integration with existing protocol modules and interfaces.
- [ ] Zero compiler warnings or lint errors under strict settings.
- [ ] Documented in architecture specifications and user guides where applicable.

### Points & Program Tagging
- **Drips Wave Program**: Stellar Wave
- **Complexity**: $diff
- **Points Value**: $pts Pts
- **Category**: $($cat.name)
"@

        $issues += @{
            id = $counter
            title = $title
            difficulty = $diff
            points = $pts
            category = $cat.name
            labels = @("Stellar Wave", $diff, $cat.tag, $cat.subtag)
            body = $body
        }
        $counter++
    }
}

$issuesJson = $issues | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText("C:\Users\lenovo\aegis-protocol\issues\issues.json", $issuesJson)

$highCount = ($issues | Where-Object { $_.difficulty -eq 'High' }).Count
$medCount = ($issues | Where-Object { $_.difficulty -eq 'Medium' }).Count
$trivCount = ($issues | Where-Object { $_.difficulty -eq 'Trivial' }).Count
$totalPoints = ($highCount * 200) + ($medCount * 150) + ($trivCount * 100)

$md = @"
# Aegis Protocol: Drips Wave Issue Catalog

This catalog contains **$($issues.Count) distinct engineering issues** structured for the **Drips Stellar Wave Program**, covering institutional bilateral repo clearing (Canton-spec), structured trade credit tranche waterfalls, SEP-8 compliance, and Stellar native fiat anchor settlements.

**Total Planned Points:** **$($totalPoints.ToString("N0")) Points** across **$($issues.Count) Issues**.

| Tier | Count | Points Per Issue | Subtotal |
| :--- | :---: | :---: | :---: |
| **High** | $highCount | 200 Pts | $(($highCount * 200).ToString("N0")) Pts |
| **Medium** | $medCount | 150 Pts | $(($medCount * 150).ToString("N0")) Pts |
| **Trivial** | $trivCount | 100 Pts | $(($trivCount * 100).ToString("N0")) Pts |
| **Total** | **$($issues.Count)** | — | **$($totalPoints.ToString("N0")) Pts** |

---

"@

foreach ($cat in $categories) {
    $catIssues = $issues | Where-Object { $_.category -eq $cat.name }
    $md += @"
## $($cat.name) ($($catIssues.Count) Issues)

| ID | Title | Complexity | Points | Labels |
| :---: | :--- | :---: | :---: | :--- |

"@
    foreach ($issue in $catIssues) {
        $lblStr = ($issue.labels | ForEach-Object { "`"$_`"" }) -join ", "
        $md += "| #$($issue.id) | $($issue.title) | **$($issue.difficulty)** | $($issue.points) Pts | $lblStr |`n"
    }
    $md += "`n"
}

[System.IO.File]::WriteAllText("C:\Users\lenovo\aegis-protocol\issues\ISSUES_CATALOG.md", $md)
Write-Output "Successfully generated $($issues.Count) issues totaling $totalPoints points."
