# `@aegis-protocol/sdk`

TypeScript client, financial unit helpers, SEP-10/24 anchor flows, and real-time Soroban RPC event stream listeners for Aegis Protocol on Stellar Soroban.

## Real-Time Event Stream Listener (`AegisEventStream`)

`AegisEventStream` subscribes to Soroban RPC `getEvents` for the deployed **AegisRepo** and **AegisCredit** contracts, decodes `ScVal` topics and payloads using strict Soroban SDK 22 `i128` / `u64` bounds, deduplicates across overlapping windows, recovers from retention-window cursor expiry, and emits typed `EventEmitter` notifications in both Node.js daemons and browser applications.

### Quick Start

```ts
import { AegisClient } from '@aegis-protocol/sdk';

const client = new AegisClient('testnet');
const stream = client.createEventStream({
  lookbackLedgers: 20,
  pollIntervalMs: 2_000,
});

stream.on('repo:proposed', (event) => {
  console.log(`Repo #${event.repoId} proposed by ${event.borrower}: ${event.cashBorrowed}`);
});

stream.on('repo:liquid', (event) => {
  console.log(`Repo #${event.repoId} liquidated (${event.status})`);
});

stream.on('credit:deposit', (event) => {
  console.log(
    `Facility #${event.facilityId} ${event.trancheName} deposit: ${event.amount} from ${event.investor}`
  );
});

stream.on('credit:repaid', (event) => {
  console.log(`Facility #${event.facilityId} repayment: ${event.amount} by ${event.payer}`);
});

stream.on('error', (err) => {
  console.error('RPC stream warning/error:', err.message);
});

stream.start();
```

### Emitted Channels

| Channel | Payload Type | Description |
|---|---|---|
| `event` | `AegisContractEvent` | Every verified Repo and Credit contract event |
| `activity` | `ActivityEvent` | Normalized activity feed item matching `client.getActivity()` |
| `repo` | `RepoContractEvent` | All `AegisRepo` events |
| `repo:proposed` / `repo:funded` / `repo:settled` / `repo:liquid` / `repo:cancel` | `RepoContractEvent` | Lifecycle-specific `AegisRepo` events |
| `credit` | `CreditContractEvent` | All `AegisCredit` events |
| `credit:created` / `credit:deposit` / `credit:drawn` / `credit:repaid` / `credit:default` / `credit:claim` / `credit:cancel` / `credit:refund` | Variant-specific `Credit*Event` | Lifecycle-specific `AegisCredit` events |
| `ledger` | `LedgerCheckpoint` | Latest synced ledger sequence and active RPC cursor |
| `reconnected` | `ReconnectInfo` | Emitted when polling recovers after transient RPC failures |
| `malformedEvent` | `(AegisEventDecodeError, EventResponse)` | Emitted if an unexpected or out-of-range contract event is encountered |
| `error` | `Error` | Transient RPC errors or retention-window cursor resets |

### Architecture & Safety Guarantees

- **Strict Soroban SDK 22 Bounds**: Validates `u64` entity IDs (`1 <= id <= Number.MAX_SAFE_INTEGER`), `RepoStatus` (`0..4`), `Tranche` (`0 | 1`), Stellar `G...` / `C...` StrKeys, and signed `i128` token amounts (`checkedAddI128` prevents overflow when computing `totalTarget = seniorTarget + juniorTarget`).
- **Failed-Call Isolation**: Ignores diagnostic events from reverted calls (`inSuccessfulContractCall === false`) by default (`includeFailedCalls` overrides).
- **Cursor Continuation & Retention Recovery**: Uses `startLedger` only until an RPC cursor is established (never mixing `startLedger` and `cursor`), drains burst pages up to `maxPagesPerPoll`, deduplicates via bounded FIFO cache, and automatically resets to `latestLedger` when a persisted cursor falls outside the RPC retention window.
