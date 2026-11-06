import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAnchor, startSep24Withdraw, getSep24Info } from '../dist/index.js';

const anchor = {
  domain: 'anchor.example',
  webAuthEndpoint: 'https://anchor.example/auth',
  transferServerSep24: 'https://anchor.example/sep24',
  signingKey: 'GCHLHDBOKG2JWMJQBTLSL5XG6NO7ESXI2TAQKZXCXWXB5WI2X6W233PR',
};

test('resolveAnchor reads SEP-10 and SEP-24 endpoints from stellar.toml', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(
      'SIGNING_KEY = "GABC"\nWEB_AUTH_ENDPOINT = "https://a.example/auth"\nTRANSFER_SERVER_SEP0024 = "https://a.example/sep24"\n'
    )
  );
  const info = await resolveAnchor('a.example');
  assert.equal(info.webAuthEndpoint, 'https://a.example/auth');
  assert.equal(info.transferServerSep24, 'https://a.example/sep24');
  assert.equal(info.signingKey, 'GABC');
});

test('resolveAnchor rejects an anchor without SEP-24', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('SIGNING_KEY = "GABC"\n'));
  await assert.rejects(resolveAnchor('a.example'), /does not advertise SEP-10 and SEP-24/);
});

// Regression: the old client returned a made-up interactive URL and session id
// when the anchor refused the request. It must surface the anchor's error instead.
test('startSep24Withdraw throws instead of inventing a session', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ error: 'invalid or missing token' }), { status: 403 })
  );
  await assert.rejects(
    startSep24Withdraw(anchor, 'bad-token', { assetCode: 'USDC', account: 'GXYZ', amount: '10' }),
    /SEP-24 withdraw failed \(403\): invalid or missing token/
  );
});

test('startSep24Withdraw sends the JWT and returns the anchor response', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ type: 'interactive_customer_info_needed', url: 'https://anchor.example/i/1', id: 'tx-1' }));
  });
  const res = await startSep24Withdraw(anchor, 'jwt', { assetCode: 'USDC', account: 'GXYZ', amount: '10' });
  assert.equal(res.id, 'tx-1');
  assert.equal(calls[0].url, 'https://anchor.example/sep24/transactions/withdraw/interactive');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer jwt');
  assert.deepEqual(JSON.parse(calls[0].init.body), { asset_code: 'USDC', account: 'GXYZ', amount: '10' });
});

// Regression: the old client returned hardcoded limits when /info failed
test('getSep24Info throws instead of returning default limits', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('nope', { status: 500 }));
  await assert.rejects(getSep24Info(anchor), /SEP-24 info failed \(500\)/);
});
