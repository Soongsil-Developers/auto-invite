import 'dotenv/config';
import { AutoInviteService } from './invite.js';
import { MatcherOptions } from './types.js';

async function main() {
  const token =
    process.env.ORG_ADMIN_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.INPUT_TOKEN;

  if (!token) {
    console.error(
      '[FATAL] Neither ORG_ADMIN_TOKEN nor GITHUB_TOKEN environment variable is set.'
    );
    console.error(
      'An admin token with "admin:org" scope is required to create organization invitations.'
    );
    process.exit(1);
  }

  const org =
    process.env.ORG_NAME ||
    process.env.INPUT_ORG_NAME ||
    'Soongsil-Developers';

  const dryRunEnv =
    process.env.DRY_RUN ||
    process.env.INPUT_DRY_RUN ||
    'false';
  const dryRun = dryRunEnv.toLowerCase() === 'true';

  const matcherOptions: MatcherOptions = {};

  if (process.env.COMPANY_REGEX) {
    matcherOptions.regex = new RegExp(process.env.COMPANY_REGEX, 'i');
  }

  if (process.env.TARGET_KEYWORDS) {
    matcherOptions.substringKeywords = process.env.TARGET_KEYWORDS.split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  if (process.env.TARGET_ACRONYMS) {
    matcherOptions.acronymKeywords = process.env.TARGET_ACRONYMS.split(',')
      .map((a) => a.trim())
      .filter(Boolean);
  }

  const delayMs = process.env.DELAY_MS
    ? parseInt(process.env.DELAY_MS, 10)
    : 150;

  const service = new AutoInviteService({
    org,
    token,
    dryRun,
    matcherOptions,
    delayMs,
  });

  try {
    const summary = await service.run();
    if (summary.failed.length > 0) {
      console.warn(`[WARN] Encountered ${summary.failed.length} failed invite(s).`);
    }
  } catch (error: any) {
    console.error(`[FATAL] Error running auto-invite service:`, error);
    process.exit(1);
  }
}

main();
