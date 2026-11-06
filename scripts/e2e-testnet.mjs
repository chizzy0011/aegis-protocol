// Live end-to-end run against the deployed testnet contracts.
//
//   npm run build --workspace=@aegis-protocol/sdk && node scripts/e2e-testnet.mjs
//
// Fresh accounts, real testnet XLM as repo collateral and Circle testnet USDC
// bought on the Stellar DEX. Every check throws on failure. Needs
// AEGIS_ADMIN_SECRET in .env for the compliance steps (the repo market is gated).
import { Address, Contract, Keypair, TransactionBuilder, nativeToScVal } from '@stellar/stellar-sdk';
import {
  AegisClient,
  AegisContractError,
  JUNIOR,
  SENIOR,
  explorerTxUrl,
  fromUnits,
  fundWithFriendbot,
  getAccountBalances,
  prepareUsdcTrustline,
  prepareXlmToUsdcSwap,
  quoteXlmToUsdc,
  submitClassicTransaction,
  toUnits,
} from '../packages/sdk/dist/index.js';
import { loadEnv } from './lib/env.mjs';
import { saveRun } from './lib/receipts.mjs';

loadEnv();
if (!process.env.AEGIS_ADMIN_SECRET) {
  throw new Error('AEGIS_ADMIN_SECRET is required: the repo market is compliance-gated on testnet');
}
const admin = Keypair.fromSecret(process.env.AEGIS_ADMIN_SECRET);
const client = new AegisClient('testnet');
const { config, deployment } = client;
const XLM = deployment.assets.collateral.contractId;
const USDC = deployment.assets.cash.contractId;
const receipts = [];

function check(condition, message) {
  if (!condition) throw new Error(`CHECK FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

function record(step, res, detail) {
  receipts.push({ step, txHash: res.hash, ledger: res.ledger, detail });
  console.log(`  → ${explorerTxUrl(config, res.hash)}`);
}

async function retry(fn, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries || !/fetch failed|ECONNRESET|ETIMEDOUT|socket|network/i.test(`${err.message} ${err.cause?.code ?? ''}`)) throw err;
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

async function expectContractError(promise, name) {
  try {
    await promise;
  } catch (err) {
    check(err instanceof AegisContractError && err.message.includes(name), `rejected with ${name}`);
    return;
  }
  throw new Error(`CHECK FAILED: expected ${name}, but the call succeeded`);
}

async function run(kp, prepared) {
  const tx = TransactionBuilder.fromXDR(prepared.xdr, config.networkPassphrase);
  tx.sign(kp);
  return client.submit(tx.toXDR());
}

async function runClassic(kp, unsignedXdr) {
  const tx = TransactionBuilder.fromXDR(unsignedXdr, config.networkPassphrase);
  tx.sign(kp);
  return submitClassicTransaction(config, tx.toXDR());
}

/** Token balance of any address (accounts or contracts) via the asset contract */
async function balanceOf(token, holder) {
  const { scValToNative, Account, BASE_FEE } = await import('@stellar/stellar-sdk');
  const tx = new TransactionBuilder(new Account(deployment.admin, '0'), { fee: BASE_FEE, networkPassphrase: config.networkPassphrase })
    .addOperation(new Contract(token).call('balance', new Address(holder).toScVal()))
    .setTimeout(30)
    .build();
  const sim = await client.server.simulateTransaction(tx);
  return BigInt(scValToNative(sim.result.retval));
}

async function account(label, xlmForUsdc) {
  const kp = Keypair.random();
  await retry(() => fundWithFriendbot(config, kp.publicKey()));
  await runClassic(kp, await retry(() => prepareUsdcTrustline(config, kp.publicKey())));
  const quote = await retry(() => quoteXlmToUsdc(config, xlmForUsdc));
  check(quote && Number(quote.usdcOut) > 0, `${label}: DEX quotes ${xlmForUsdc} XLM -> ${quote?.usdcOut} USDC`);
  const res = await runClassic(kp, await retry(() => prepareXlmToUsdcSwap(config, kp.publicKey(), quote)));
  const usdc = (await retry(() => getAccountBalances(config, kp.publicKey()))).usdc;
  record(`${label}: swap XLM for USDC on the Stellar DEX`, res, `${xlmForUsdc} XLM -> ${usdc} USDC`);
  return kp;
}

async function verify(kp, tier, label) {
  const res = await run(
    admin,
    await client.prepareInvocation(admin.publicKey(), deployment.contracts.compliance, 'set_investor_tier', [
      new Address(admin.publicKey()).toScVal(),
      new Address(kp.publicKey()).toScVal(),
      nativeToScVal(tier, { type: 'u32' }),
      nativeToScVal(566, { type: 'u32' }),
      nativeToScVal(BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400), { type: 'u64' }),
    ])
  );
  check((await client.tierOf(kp.publicKey())) === tier, `${label} verified at tier ${tier}`);
  record(`admin: compliance.set_investor_tier(${label}, ${tier})`, res, 'testnet KYC record, expires in 7 days');
}

async function main() {
  console.log(`Aegis testnet e2e · repo ${deployment.contracts.repo} · credit ${deployment.contracts.credit}\n`);

  console.log('[1] Fresh accounts with real testnet USDC');
  // The borrower repays 8 USDC of credit plus interest out of the 8 it draws, so it needs a buffer
  const borrower = await account('borrower', '10');
  const lender = await account('lender', '20');
  const senior = await account('senior investor', '10');
  const junior = await account('junior investor', '5');
  const b = borrower.publicKey();

  console.log('\n[2] Repo market is gated at Accredited');
  const terms = {
    collateralToken: XLM,
    collateralAmount: toUnits('100'),
    cashToken: USDC,
    cashRequested: toUnits('10'),
    repoRateBps: 500,
    termSeconds: 3600,
    haircutBps: 2000,
  };
  await expectContractError(client.proposeRepo(b, terms), 'NotEligible');
  await verify(borrower, 2, 'borrower');

  console.log('\n[3] Borrower proposes: 100 XLM escrowed against 10 USDC');
  const escrowBefore = await balanceOf(XLM, deployment.contracts.repo);
  const proposed = await run(borrower, await client.proposeRepo(b, terms));
  const repoId = Number(proposed.returnValue);
  check((await balanceOf(XLM, deployment.contracts.repo)) - escrowBefore === toUnits('100'), `repo #${repoId}: 100 XLM held in escrow by the contract`);
  check((await client.getRepo(repoId)).status === 'Pending', 'agreement is Pending');
  record(`borrower: repo.propose_repo #${repoId}`, proposed, '100 XLM collateral, 10 USDC requested, 5% APR, 1 hour, 20% haircut');

  console.log('\n[4] Lender funds it with delivery-versus-payment');
  await expectContractError(client.executeDvp(lender.publicKey(), repoId), 'NotEligible');
  await verify(lender, 3, 'lender');
  const borrowerUsdcBefore = await balanceOf(USDC, b);
  const funded = await run(lender, await client.executeDvp(lender.publicKey(), repoId));
  check((await balanceOf(USDC, b)) - borrowerUsdcBefore === toUnits('10'), 'borrower received 10 USDC in the same transaction');
  const active = await client.getRepo(repoId);
  check(active.status === 'Active' && active.lender === lender.publicKey(), 'agreement is Active with the lender recorded');
  record(`lender: repo.execute_dvp #${repoId}`, funded, `10 USDC to borrower; repurchase ${fromUnits(active.repurchaseAmount)} USDC`);

  console.log('\n[5] Borrower repurchases');
  await expectContractError(client.settleRepo(senior.publicKey(), repoId), 'Unauthorized');
  const lenderUsdcBefore = await balanceOf(USDC, lender.publicKey());
  const escrowMid = await balanceOf(XLM, deployment.contracts.repo);
  const settled = await run(borrower, await client.settleRepo(b, repoId));
  check((await balanceOf(USDC, lender.publicKey())) - lenderUsdcBefore === active.repurchaseAmount, 'lender received principal plus repo interest');
  check(escrowMid - (await balanceOf(XLM, deployment.contracts.repo)) === toUnits('100'), 'collateral released from escrow');
  check((await client.getRepo(repoId)).status === 'Closed', 'agreement is Closed');
  record(`borrower: repo.settle_repurchase #${repoId}`, settled, `${fromUnits(active.repurchaseAmount)} USDC to lender, 100 XLM back to borrower`);

  console.log('\n[6] An unfunded proposal can be cancelled');
  const second = await run(borrower, await client.proposeRepo(b, { ...terms, collateralAmount: toUnits('50'), cashRequested: toUnits('5') }));
  const secondId = Number(second.returnValue);
  const escrowHeld = await balanceOf(XLM, deployment.contracts.repo);
  const cancelled = await run(borrower, await client.cancelRepo(b, secondId));
  check(escrowHeld - (await balanceOf(XLM, deployment.contracts.repo)) === toUnits('50'), `repo #${secondId}: 50 XLM returned on cancel`);
  record(`borrower: repo.cancel_repo #${secondId}`, cancelled, '50 XLM collateral returned');

  console.log('\n[7] Credit facility: senior 6 USDC @ 10%, junior 2 USDC @ 20%');
  const created = await run(
    borrower,
    await client.createFacility(b, {
      invoiceRef: `E2E-${Date.now()}`,
      currencyToken: USDC,
      seniorTarget: toUnits('6'),
      juniorTarget: toUnits('2'),
      seniorAprBps: 1000,
      juniorAprBps: 2000,
      durationSeconds: 3600,
    })
  );
  const fid = Number(created.returnValue);
  record(`borrower: credit.create_facility #${fid}`, created, '8 USDC across two tranches, 1 hour');
  record('senior investor: credit.deposit (senior)', await run(senior, await client.depositTranche(senior.publicKey(), fid, SENIOR, toUnits('6'))), '6 USDC');
  record('junior investor: credit.deposit (junior)', await run(junior, await client.depositTranche(junior.publicKey(), fid, JUNIOR, toUnits('2'))), '2 USDC');
  const drawn = await run(borrower, await client.drawdown(b, fid));
  check(BigInt(drawn.returnValue) === toUnits('8'), 'borrower drew 8 USDC');
  record(`borrower: credit.drawdown #${fid}`, drawn, '8 USDC to the borrower');

  console.log('\n[8] Partial repayment goes to senior first');
  record(`borrower: credit.repay #${fid}`, await run(borrower, await client.repay(b, fid, toUnits('5'))), '5 USDC');
  check((await client.getPosition(fid, junior.publicKey())).claimable === 0n, 'junior has nothing claimable yet');
  const firstClaim = await run(senior, await client.claim(senior.publicKey(), fid));
  check(BigInt(firstClaim.returnValue) === toUnits('5'), 'senior claimed all 5 USDC');
  record(`senior investor: credit.claim #${fid}`, firstClaim, '5 USDC');

  console.log('\n[9] Full repayment pays both tranches with interest');
  const f = await client.getFacility(fid);
  const remaining = f.seniorOwed + f.juniorOwed - f.repaidAmount;
  const repaid = await run(borrower, await client.repay(b, fid, remaining));
  check((await client.getFacility(fid)).status === 'Repaid', `facility Repaid after ${fromUnits(remaining)} USDC`);
  record(`borrower: credit.repay #${fid}`, repaid, `${fromUnits(remaining)} USDC, fully repaid`);
  const seniorRest = await run(senior, await client.claim(senior.publicKey(), fid));
  check(BigInt(seniorRest.returnValue) === f.seniorOwed - toUnits('5'), `senior claimed the remaining ${fromUnits(f.seniorOwed - toUnits('5'))} USDC (principal + interest)`);
  record(`senior investor: credit.claim #${fid}`, seniorRest, `${fromUnits(f.seniorOwed - toUnits('5'))} USDC`);
  const juniorClaim = await run(junior, await client.claim(junior.publicKey(), fid));
  check(BigInt(juniorClaim.returnValue) === f.juniorOwed, `junior claimed ${fromUnits(f.juniorOwed)} USDC (principal + interest)`);
  record(`junior investor: credit.claim #${fid}`, juniorClaim, `${fromUnits(f.juniorOwed)} USDC`);

  console.log('\n[10] Events are queryable');
  const activity = await client.getActivity(60);
  check(activity.some((e) => e.source === 'repo' && e.action === 'settled' && e.id === repoId), 'getActivity() returns the repo settlement');
  check(activity.some((e) => e.source === 'credit' && e.action === 'claim' && e.id === fid), 'getActivity() returns the credit claims');

  saveRun('testnet', b, receipts);
  console.log(`\nAll checks passed. ${receipts.length} transactions recorded.`);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
