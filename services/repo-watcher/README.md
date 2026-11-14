# `@aegis-protocol/repo-watcher`

Monitors on-chain **AegisRepo** agreements on Stellar Soroban and constructs/broadcasts atomic `liquidate_default` transaction envelopes upon maturity and grace-period expiry.

## Atomic Liquidation Transaction Generator

`AtomicLiquidationGenerator` scans active repo agreements, enforces strict post-maturity grace boundaries matching `AegisRepoContract::liquidate_default` (`ledger.timestamp() > maturity_timestamp + gracePeriodSeconds`), simulates Soroban invocations, caps total inclusion + resource fees in stroops, assembles Soroban footprints/auth entries, signs via a lender `Keypair` or external HSM/KMS `LiquidationSigner`, and broadcasts sequentially so lender sequence numbers advance deterministically.

### Programmatic Usage

```ts
import { Keypair } from '@stellar/stellar-sdk';
import { AegisClient } from '@aegis-protocol/sdk';
import { AtomicLiquidationGenerator } from '@aegis-protocol/repo-watcher';

const client = new AegisClient('testnet');
const lenderKeypair = Keypair.fromSecret(process.env.AEGIS_LENDER_SECRET!);

const liquidator = new AtomicLiquidationGenerator(client, {
  gracePeriodSeconds: 300,
  maxFeeStroops: 2_500_000n,
  signer: lenderKeypair,
});

const summary = await liquidator.processDefaultedRepos();
for (const item of summary.results) {
  if (item.status === 'submitted') {
    console.log(`Liquidated repo #${item.repoId} in tx ${item.submission?.hash}`);
  }
}
```

### CLI & Daemon Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AEGIS_NETWORK` | `testnet` | Target network (`testnet` or `mainnet`) |
| `AEGIS_RPC_URL` | SDK network default | Custom Soroban RPC endpoint |
| `AEGIS_GRACE_PERIOD_SECONDS` | `0` | Additional post-maturity grace window in seconds (`0..31536000`) |
| `AEGIS_MAX_FEE_STROOPS` | `5000000` | Maximum allowed `baseFee + minResourceFee` per liquidation tx |
| `AEGIS_LIQUIDATE_DRY_RUN` | `false` | Simulate and assemble liquidation envelopes without signing/submitting |
| `AEGIS_AUTO_LIQUIDATE` | `false` | Broadcast signed `liquidate_default` envelopes when `AEGIS_LENDER_SECRET` is set |
| `AEGIS_LENDER_SECRET` | unset | Lender secret key (`S...`); never logged or written to stdout |

### Safety & Soroban SDK 22 Guarantees

- **Strict Expiry Inequality**: `AegisRepoContract::liquidate_default` rejects calls when `ledger.timestamp() <= maturity_timestamp` with `TermNotExpired (#6)`. `isDefaultedAndEligible` enforces `nowTimestamp > maturityTimestamp + gracePeriodSeconds` using `BigInt` arithmetic so boundary-second transactions never revert on-chain.
- **On-Chain Re-Verification & Idempotency**: Re-reads `client.getRepo(id)` immediately before building each transaction to skip repos settled at the last second by the borrower (`Closed`) or already `Liquidated`, and tracks processed/in-flight IDs to prevent duplicate broadcasts.
- **Fee Ceiling**: Rejects envelopes with `LiquidationError('FEE_CAP_EXCEEDED')` whenever `baseFeeStroops + minResourceFeeStroops > maxFeeStroops`.
