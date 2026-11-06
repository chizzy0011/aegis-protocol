import { WebAuth } from '@stellar/stellar-sdk';

/**
 * SEP-1 / SEP-10 / SEP-24 client. Every step talks to the anchor for real and
 * throws on failure; nothing is ever substituted with a made-up response.
 */

export const TEST_ANCHOR_DOMAIN = 'testanchor.stellar.org';

export interface AnchorInfo {
  domain: string;
  webAuthEndpoint: string;
  transferServerSep24: string;
  signingKey: string;
}

export interface Sep24AssetInfo {
  enabled: boolean;
  min_amount?: number;
  max_amount?: number;
  fee_fixed?: number;
  fee_percent?: number;
}

export interface Sep24Info {
  deposit: Record<string, Sep24AssetInfo>;
  withdraw: Record<string, Sep24AssetInfo>;
}

export interface Sep24InteractiveResponse {
  type: 'interactive_customer_info_needed';
  url: string;
  id: string;
}

export interface Sep24Transaction {
  id: string;
  kind: string;
  status: string;
  amount_in?: string;
  amount_out?: string;
  more_info_url?: string;
}

async function anchorError(res: Response, what: string): Promise<Error> {
  let detail = '';
  try {
    const body = await res.json();
    detail = body.error ?? JSON.stringify(body);
  } catch {
    detail = res.statusText;
  }
  return new Error(`${what} failed (${res.status}): ${detail}`);
}

/** SEP-1: read the anchor's stellar.toml */
export async function resolveAnchor(domain: string): Promise<AnchorInfo> {
  const res = await fetch(`https://${domain}/.well-known/stellar.toml`);
  if (!res.ok) {
    throw new Error(`Could not load stellar.toml from ${domain} (${res.status})`);
  }
  const toml = await res.text();
  const read = (key: string) => new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm').exec(toml)?.[1];

  const webAuthEndpoint = read('WEB_AUTH_ENDPOINT');
  const transferServerSep24 = read('TRANSFER_SERVER_SEP0024');
  const signingKey = read('SIGNING_KEY');
  if (!webAuthEndpoint || !transferServerSep24 || !signingKey) {
    throw new Error(`${domain} does not advertise SEP-10 and SEP-24 in its stellar.toml`);
  }
  return { domain, webAuthEndpoint, transferServerSep24, signingKey };
}

/**
 * SEP-10 step 1: fetch the challenge and verify it before anyone signs it
 * (server signature, home domain, web auth domain, no unexpected operations).
 */
export async function getSep10Challenge(
  anchor: AnchorInfo,
  account: string,
  networkPassphrase: string
): Promise<string> {
  const res = await fetch(`${anchor.webAuthEndpoint}?account=${encodeURIComponent(account)}`);
  if (!res.ok) throw await anchorError(res, 'SEP-10 challenge');
  const body = (await res.json()) as { transaction: string; network_passphrase?: string };
  if (body.network_passphrase && body.network_passphrase !== networkPassphrase) {
    throw new Error(`Anchor is on a different network: ${body.network_passphrase}`);
  }

  WebAuth.readChallengeTx(
    body.transaction,
    anchor.signingKey,
    networkPassphrase,
    anchor.domain,
    new URL(anchor.webAuthEndpoint).host
  );
  return body.transaction;
}

/** SEP-10 step 2: exchange the client-signed challenge for a JWT */
export async function getSep10Token(anchor: AnchorInfo, signedChallengeXdr: string): Promise<string> {
  const res = await fetch(anchor.webAuthEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedChallengeXdr }),
  });
  if (!res.ok) throw await anchorError(res, 'SEP-10 token');
  const { token } = (await res.json()) as { token: string };
  return token;
}

export async function getSep24Info(anchor: AnchorInfo): Promise<Sep24Info> {
  const res = await fetch(`${anchor.transferServerSep24}/info`);
  if (!res.ok) throw await anchorError(res, 'SEP-24 info');
  return (await res.json()) as Sep24Info;
}

/** SEP-24: start an authenticated interactive withdrawal (off-ramp) */
export async function startSep24Withdraw(
  anchor: AnchorInfo,
  token: string,
  params: { assetCode: string; account: string; amount?: string }
): Promise<Sep24InteractiveResponse> {
  const res = await fetch(`${anchor.transferServerSep24}/transactions/withdraw/interactive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      asset_code: params.assetCode,
      account: params.account,
      ...(params.amount ? { amount: params.amount } : {}),
    }),
  });
  if (!res.ok) throw await anchorError(res, 'SEP-24 withdraw');
  return (await res.json()) as Sep24InteractiveResponse;
}

export async function getSep24Transaction(
  anchor: AnchorInfo,
  token: string,
  id: string
): Promise<Sep24Transaction> {
  const res = await fetch(`${anchor.transferServerSep24}/transaction?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await anchorError(res, 'SEP-24 transaction');
  const { transaction } = (await res.json()) as { transaction: Sep24Transaction };
  return transaction;
}
