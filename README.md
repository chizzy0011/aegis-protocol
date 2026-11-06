# Aegis Protocol

[![Soroban Contracts CI](https://github.com/chizzy0011/aegis-protocol/actions/workflows/contracts.yml/badge.svg)](https://github.com/chizzy0011/aegis-protocol/actions/workflows/contracts.yml)
[![SDK & Web CI](https://github.com/chizzy0011/aegis-protocol/actions/workflows/sdk-and-web.yml/badge.svg)](https://github.com/chizzy0011/aegis-protocol/actions/workflows/sdk-and-web.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

Secured short-term lending on Stellar Soroban: **bilateral repo with delivery-versus-payment**, **two-tranche trade-credit facilities with a senior-first repayment waterfall**, and an **on-chain compliance gate** both markets check before every action.

- **App (Stellar testnet):** https://chizzy0011.github.io/aegis-protocol/
- **Deployment manifest:** [deployments/testnet.json](deployments/testnet.json)
- **Receipts from the last live end-to-end run:** [deployments/testnet-receipts.json](deployments/testnet-receipts.json)

## Status

Everything marked **live** is deployed on Stellar **testnet** and exercised by [`scripts/e2e-testnet.mjs`](scripts/e2e-testnet.mjs) with fresh accounts, real testnet XLM as collateral and Circle testnet USDC bought on the Stellar DEX. Nothing is on mainnet.

| Capability | Status |
|---|---|
| Compliance registry (tier, country, sanctions, expiry) gating both markets | live (testnet) |
| Repo: propose with collateral escrow, DvP funding, repurchase, cancel | live (testnet) |
| Repo: liquidation by the lender after maturity | implemented and unit-tested |
| Credit: senior/junior funding, drawdown, repayment, senior-first claims | live (testnet) |
| Credit: cancel and refund, default after a 7-day grace period | implemented and unit-tested |
| Settlement records of anchor off-ramps, confirmed by the anchor | implemented and unit-tested; not exercised on testnet (no anchor key) |
| SEP-10 sign-in and SEP-24 withdrawal against the SDF test anchor | live (testnet) |
| Price oracle / margin calls | not built. The haircut caps cash at collateral × (1 − haircut) in token units; lenders price collateral themselves |
| KYC provider integration | not built. Testnet verification records are written by the Aegis admin |
| Invoice verification | not built. Invoice references are borrower-supplied text |
| Mainnet deployment, security audit | not yet |

## Deployed contracts (Stellar testnet)

| Contract | Address |
|---|---|
| AegisCompliance | [`CAP45NFRQW5PUUKN4SL4LNRCL3Y5XKPBFWZBM2JPDU37XO5RY44WVRZL`](https://stellar.expert/explorer/testnet/contract/CAP45NFRQW5PUUKN4SL4LNRCL3Y5XKPBFWZBM2JPDU37XO5RY44WVRZL) |
| AegisRepo (requires Accredited tier) | [`CAS6EIMV5R6V6CRCZLVQEM5ML2FIRYBOVPUK5HV5KUAZCKEJSYVUVJ5H`](https://stellar.expert/explorer/testnet/contract/CAS6EIMV5R6V6CRCZLVQEM5ML2FIRYBOVPUK5HV5KUAZCKEJSYVUVJ5H) |
| AegisCredit (open pilot) | [`CCWPEMHF26ZZAYTRLUL5TFRFOQMOLMPNRADHB4FP2654DPQYDH2OALPE`](https://stellar.expert/explorer/testnet/contract/CCWPEMHF26ZZAYTRLUL5TFRFOQMOLMPNRADHB4FP2654DPQYDH2OALPE) |
| AegisSettlement | [`CCFMPWEG6WZS5R6CZII7QH3N4AIP24EINM4O6DN74HPF5Z5ASVGTUARK`](https://stellar.expert/explorer/testnet/contract/CCFMPWEG6WZS5R6CZII7QH3N4AIP24EINM4O6DN74HPF5Z5ASVGTUARK) |

On testnet the repo collateral is native XLM and the cash leg is Circle testnet USDC (`CBIELTK6…DAMA`). Every deploy and init transaction is in [deployments/testnet.json](deployments/testnet.json).

### Verified run

The last end-to-end run ([receipts](deployments/testnet-receipts.json)) checked 28 on-chain conditions across 19 transactions, including:

- unverified borrower and lender rejected with `NotEligible`, then verified by the compliance admin
- [repo #1 proposed](https://stellar.expert/explorer/testnet/tx/1014c5253050f0befc1142ae8241f43d6b92fd7bd47935182d07e9c872733672) with 100 XLM escrowed, [funded by DvP](https://stellar.expert/explorer/testnet/tx/75c9be9258ab825e8c40d4725a403ba10578de33431b847d3c655f26c45cfd2e) (10 USDC to the borrower in the same transaction), a third-party repurchase rejected, then [repurchased by the borrower](https://stellar.expert/explorer/testnet/tx/7265c63e9ecc533752c0859f42256bb251651ac2f96a5b366e6bd41ee9d10860)
- [repo #2 cancelled](https://stellar.expert/explorer/testnet/tx/9aec88cba55a2808beac332ae97804c48e9fa485428537faef39eca323fec88a) with the collateral returned
- [facility #1](https://stellar.expert/explorer/testnet/tx/039df499c651050ca8928ef6753a982c889bb6e74c8d5355a8820410c536c55f) funded senior and junior, [drawn](https://stellar.expert/explorer/testnet/tx/2dbb4ddfa4f3f544b73a02f7e546bb40f2a75a23991e3448eace7f797ba8d614), a partial repayment paid entirely to senior, then [repaid in full](https://stellar.expert/explorer/testnet/tx/5bb45560bd4be6970faedc9d43cbd29436bb62bcb1f258a629e8583b2912e53d) and [claimed by junior with interest](https://stellar.expert/explorer/testnet/tx/c8a47c150b3ef2ea324e896a447803dd9d6ce76694feddaf6307dfd47a2a761f)

## How it works

**Compliance.** The admin (the KYC provider) records each participant's tier (1 Retail, 2 Accredited, 3 Institutional), country, sanction status and expiry. `tier_of(account)` returns 0 for unknown, sanctioned or expired accounts. Each market has a `required_tier` (0 = open) that it checks before proposals, funding and deposits. Settlement of an existing repo is not gated, so a later sanction can't trap collateral.

**Repo.** The borrower calls `propose_repo`, which escrows the collateral and fixes the cash amount, rate, term and haircut; the repurchase price is computed up front. A lender calls `execute_dvp`: the cash goes to the borrower in the same transaction that records the lender. Only the borrower can `settle_repurchase` (principal plus interest to the lender, collateral back). After maturity the lender can `liquidate_default` and take the collateral. An unfunded proposal can be cancelled.

**Credit.** The borrower opens a facility with senior and junior targets and APRs. Investors `deposit` into either tranche; when both are full the borrower `drawdown`s the USDC. Anyone can `repay` (capped at what is owed). Repayments are distributed senior-first: senior principal plus interest is covered before junior receives anything, and investors `claim` their share whenever more has been repaid. A facility that isn't drawn can be cancelled and refunded; one that is unpaid 7 days past due can be marked defaulted, and later repayments still flow down the waterfall.

**Settlement.** The borrower of a drawn facility can record an off-ramp through a registered anchor using the anchor's SEP-24 transaction id (bank details never go on-chain); only that anchor's key can confirm it. No funds move through this contract.

## Security properties and the tests that check them

| Property | Test |
|---|---|
| Only the borrower can repurchase; a third party can't pay the debt and take the collateral | `repo::test_third_party_cannot_settle_and_take_collateral` |
| Collateral leaves escrow only via repurchase, cancel or post-maturity liquidation | `repo::test_cancel_returns_collateral_only_while_pending`, `test_liquidation_only_by_lender_after_maturity` |
| Repo terms are bounded (haircut < 100%, rate ≤ 100%/yr, term 1 min–1 yr, different tokens) | `repo::test_terms_are_validated` |
| Both markets enforce the compliance tier on every participant | `repo::test_compliance_tier_gates_both_sides`, `credit::test_compliance_tier_gates_borrowers_and_investors` |
| Senior is paid before junior; claims are exact and incremental; nothing is stranded | `credit::test_waterfall_pays_senior_first_and_junior_absorbs_losses`, `test_full_lifecycle_pays_both_tranches_with_interest` |
| Repayments are capped at the amount owed | `credit::test_repayment_is_capped_at_amount_owed` |
| Undrawn facilities can be cancelled and every deposit refunded | `credit::test_cancel_and_refund_before_drawdown` |
| Only the facility's borrower records payouts; only the named anchor confirms | `settlement::test_only_the_facility_borrower_can_record_payouts`, `test_borrower_records_payout_after_drawdown_and_anchor_confirms` |

Records live in persistent storage with TTL extension; the counters and config live in instance storage.

## Repository

```
contracts/
  compliance/   investor registry and tier_of() gate
  repo/         bilateral DvP repo
  credit/       two-tranche facilities with a senior-first waterfall
  settlement/   anchor off-ramp records
packages/sdk/   @aegis-protocol/sdk: contract client, DEX helpers, SEP-10/24
services/repo-watcher/  reports pending, due and past-maturity repos from chain state
apps/web/       Next.js app (Freighter) on GitHub Pages
scripts/        deploy.mjs (resumable) and e2e-testnet.mjs (live run)
deployments/    testnet manifest and receipts
```

## Development

Prerequisites: Rust with the `wasm32v1-none` target, Node.js 22.

```bash
npm install

# Contracts: build the wasm first (tests import sibling contracts), then test
npm run contracts:test

# SDK unit tests
npm run test --workspace=@aegis-protocol/sdk

# Web app
npm run dev --workspace=@aegis-protocol/web

# Deploy to testnet (creates a funded admin key in the gitignored .env on first run)
npm run contracts:build && npm run build --workspace=@aegis-protocol/sdk
npm run deploy:testnet

# Live end-to-end run (needs AEGIS_ADMIN_SECRET in .env for the compliance steps)
npm run e2e:testnet

# Repo watcher
npm run build --workspace=@aegis-protocol/repo-watcher && node services/repo-watcher/dist/index.js
```

Never commit `.env` or paste secret keys anywhere; it is gitignored.

## License

Apache-2.0.
