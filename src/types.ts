export interface FollowerUser {
  login: string;
  id: number;
  html_url?: string;
}

export interface UserDetail {
  login: string;
  id: number;
  company: string | null;
  name?: string | null;
  html_url?: string;
}

export type SkipReason =
  | 'already_member'
  | 'already_invited'
  | 'no_company'
  | 'company_mismatch';

export interface SkippedUser {
  login: string;
  id: number;
  company: string | null;
  reason: SkipReason;
}

export interface InvitedUser {
  login: string;
  id: number;
  company: string;
  status: 'invited' | 'dry_run';
}

export interface FailedUser {
  login: string;
  id: number;
  company: string;
  error: string;
}

export interface MatcherOptions {
  /**
   * Substrings to match (case-insensitive, trimmed).
   * Default: ['soongsil', 'soogsil', '숭실']
   */
  substringKeywords?: string[];

  /**
   * Standalone acronyms/words matched with boundary checks (e.g. 'ssu').
   * Prevents false positives like 'issue' or 'tissue'.
   * Default: ['ssu']
   */
  acronymKeywords?: string[];

  /**
   * Optional custom regular expression override.
   */
  regex?: RegExp;
}

export interface InviteServiceOptions {
  org: string;
  token: string;
  dryRun?: boolean;
  matcherOptions?: MatcherOptions;
  delayMs?: number;
}

export interface RunSummary {
  org: string;
  dryRun: boolean;
  totalFollowers: number;
  alreadyMembers: number;
  alreadyInvited: number;
  companyMatched: number;
  invited: InvitedUser[];
  skipped: SkippedUser[];
  failed: FailedUser[];
}
