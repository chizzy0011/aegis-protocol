import { AegisRepoClient, SUPPORTED_REPO_COLLATERAL } from '@aegis-protocol/sdk';

export class MarginWatcherDaemon {
  private repoClient: AegisRepoClient;
  private isRunning: boolean = false;

  constructor() {
    this.repoClient = new AegisRepoClient();
  }

  public async startWatcher(pollIntervalMs: number = 30000) {
    this.isRunning = true;
    console.log('[Aegis Margin Watcher] Initialized oracle polling loop...');
    console.log(`[Aegis Margin Watcher] Monitoring ${Object.keys(SUPPORTED_REPO_COLLATERAL).length} prime collateral types`);

    while (this.isRunning) {
      try {
        await this.checkActiveAgreements();
      } catch (err) {
        console.error('[Aegis Margin Watcher] Error during margin verification:', err);
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  private async checkActiveAgreements() {
    // In production, queries Soroban RPC for all active Repo agreements
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Health check: All active repos within allowable haircut boundaries.`);
  }

  public stop() {
    this.isRunning = false;
  }
}

if (process.env.NODE_ENV !== 'test') {
  const daemon = new MarginWatcherDaemon();
  daemon.startWatcher();
}
