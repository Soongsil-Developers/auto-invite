import { Octokit } from '@octokit/rest';
import {
  FollowerUser,
  InviteServiceOptions,
  RunSummary,
  UserDetail,
} from './types.js';
import { isCompanyMatching } from './matcher.js';

export class AutoInviteService {
  private octokit: Octokit;
  private org: string;
  private dryRun: boolean;
  private delayMs: number;
  private matcherOptions;

  constructor(options: InviteServiceOptions, octokitClient?: Octokit) {
    this.org = options.org;
    this.dryRun = options.dryRun ?? false;
    this.delayMs = options.delayMs ?? 100;
    this.matcherOptions = options.matcherOptions ?? {};
    this.octokit =
      octokitClient ??
      new Octokit({
        auth: options.token,
      });
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retrieves all followers of the target organization/user.
   */
  async getFollowers(): Promise<FollowerUser[]> {
    const followers = await this.octokit.paginate(
      this.octokit.rest.users.listFollowersForUser,
      {
        username: this.org,
        per_page: 100,
      }
    );

    return followers.map((f) => ({
      login: f.login,
      id: f.id,
      html_url: f.html_url,
    }));
  }

  /**
   * Retrieves all current members and outside collaborators of the organization (People tab).
   * Returns a set of lowercased logins.
   */
  async getExistingMemberLogins(): Promise<Set<string>> {
    const memberSet = new Set<string>();

    // 1. Fetch active organization members
    try {
      const members = await this.octokit.paginate(
        this.octokit.rest.orgs.listMembers,
        {
          org: this.org,
          per_page: 100,
        }
      );

      for (const m of members) {
        memberSet.add(m.login.toLowerCase());
      }
    } catch (error: any) {
      console.warn(`[WARN] Could not retrieve existing members: ${error?.message || error}`);
    }

    // 2. Fetch outside collaborators (also listed under People tab)
    try {
      const collaborators = await this.octokit.paginate(
        this.octokit.rest.orgs.listOutsideCollaborators,
        {
          org: this.org,
          per_page: 100,
        }
      );

      for (const c of collaborators) {
        memberSet.add(c.login.toLowerCase());
      }
    } catch {
      // Outside collaborators might be restricted or empty; gracefully ignore
    }

    return memberSet;
  }

  /**
   * Retrieves all pending invitations of the organization.
   * Returns a set of lowercased logins and user IDs.
   */
  async getPendingInvitations(): Promise<{ logins: Set<string>; userIds: Set<number> }> {
    const logins = new Set<string>();
    const userIds = new Set<number>();

    try {
      const invitations = await this.octokit.paginate(
        this.octokit.rest.orgs.listPendingInvitations,
        {
          org: this.org,
          per_page: 100,
        }
      );

      for (const inv of invitations) {
        if (inv.login) {
          logins.add(inv.login.toLowerCase());
        }
        if (typeof (inv as any).id === 'number') {
          userIds.add((inv as any).id);
        }
      }
    } catch (error: any) {
      console.warn(`[WARN] Could not retrieve pending invitations: ${error?.message || error}`);
    }

    return { logins, userIds };
  }

  /**
   * Fetches detailed profile of a user, including their company field.
   */
  async getUserDetail(username: string): Promise<UserDetail> {
    const { data } = await this.octokit.rest.users.getByUsername({
      username,
    });

    return {
      login: data.login,
      id: data.id,
      company: data.company ?? null,
      name: data.name ?? null,
      html_url: data.html_url,
    };
  }

  /**
   * Creates an invitation for a user to join the organization.
   */
  async sendInvitation(
    userId: number,
    username: string
  ): Promise<{ success: boolean; status: 'invited' | 'dry_run' | 'failed'; error?: string }> {
    if (this.dryRun) {
      console.log(`[DRY RUN] Would invite @${username} (id: ${userId}) to @${this.org}`);
      return { success: true, status: 'dry_run' };
    }

    try {
      await this.octokit.rest.orgs.createInvitation({
        org: this.org,
        invitee_id: userId,
        role: 'direct_member',
      });
      console.log(`[SUCCESS] Invited @${username} (id: ${userId}) to @${this.org}`);
      return { success: true, status: 'invited' };
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Unknown error';
      console.error(`[ERROR] Failed to invite @${username} (id: ${userId}): ${msg}`);
      return { success: false, status: 'failed', error: msg };
    }
  }

  /**
   * Main execution workflow:
   * 1. Fetches followers of organization
   * 2. Fetches existing members
   * 3. Fetches pending invitations
   * 4. For each follower not yet a member or pending, checks company profile
   * 5. Invites matched users
   */
  async run(): Promise<RunSummary> {
    console.log(`Starting follower check for organization: @${this.org}`);
    console.log(`Mode: ${this.dryRun ? 'DRY-RUN (Simulated)' : 'PRODUCTION (Sending Invites)'}`);

    const summary: RunSummary = {
      org: this.org,
      dryRun: this.dryRun,
      totalFollowers: 0,
      alreadyMembers: 0,
      alreadyInvited: 0,
      companyMatched: 0,
      invited: [],
      skipped: [],
      failed: [],
    };

    console.log('Fetching followers...');
    const followers = await this.getFollowers();
    summary.totalFollowers = followers.length;
    console.log(`Found ${followers.length} followers for @${this.org}`);

    console.log('Fetching existing members and pending invitations...');
    const [memberLogins, pending] = await Promise.all([
      this.getExistingMemberLogins(),
      this.getPendingInvitations(),
    ]);
    console.log(`Found ${memberLogins.size} active members and ${pending.logins.size} pending invitations`);

    for (const follower of followers) {
      const lowerLogin = follower.login.toLowerCase();

      // Check 1: Already an active member?
      if (memberLogins.has(lowerLogin)) {
        summary.alreadyMembers++;
        summary.skipped.push({
          login: follower.login,
          id: follower.id,
          company: null,
          reason: 'already_member',
        });
        continue;
      }

      // Check 2: Already has a pending invitation?
      if (pending.logins.has(lowerLogin) || pending.userIds.has(follower.id)) {
        summary.alreadyInvited++;
        summary.skipped.push({
          login: follower.login,
          id: follower.id,
          company: null,
          reason: 'already_invited',
        });
        continue;
      }

      // Small delay between profile queries
      await this.sleep(this.delayMs);

      // Check 3: Check user's company profile
      let detail: UserDetail;
      try {
        detail = await this.getUserDetail(follower.login);
      } catch (err: any) {
        console.warn(`[WARN] Failed to fetch profile for @${follower.login}: ${err?.message || err}`);
        continue;
      }

      if (!detail.company) {
        summary.skipped.push({
          login: follower.login,
          id: follower.id,
          company: null,
          reason: 'no_company',
        });
        continue;
      }

      const isMatch = isCompanyMatching(detail.company, this.matcherOptions);
      if (!isMatch) {
        summary.skipped.push({
          login: follower.login,
          id: follower.id,
          company: detail.company,
          reason: 'company_mismatch',
        });
        continue;
      }

      summary.companyMatched++;
      console.log(`[MATCH] @${follower.login} matches company criteria: "${detail.company}"`);

      // Invitation delay to prevent secondary rate limits
      await this.sleep(this.delayMs);

      const inviteResult = await this.sendInvitation(follower.id, follower.login);
      if (inviteResult.success) {
        summary.invited.push({
          login: follower.login,
          id: follower.id,
          company: detail.company,
          status: inviteResult.status as 'invited' | 'dry_run',
        });
      } else {
        summary.failed.push({
          login: follower.login,
          id: follower.id,
          company: detail.company,
          error: inviteResult.error || 'Failed to invite',
        });
      }
    }

    console.log('\n========================================');
    console.log('          Execution Summary             ');
    console.log('========================================');
    console.log(`Organization: @${this.org}`);
    console.log(`Dry Run: ${this.dryRun}`);
    console.log(`Total Followers: ${summary.totalFollowers}`);
    console.log(`Already Members: ${summary.alreadyMembers}`);
    console.log(`Already Invited: ${summary.alreadyInvited}`);
    console.log(`Company Matched: ${summary.companyMatched}`);
    console.log(`Successfully Processed: ${summary.invited.length}`);
    console.log(`Failed Invites: ${summary.failed.length}`);
    console.log('========================================\n');

    return summary;
  }
}
