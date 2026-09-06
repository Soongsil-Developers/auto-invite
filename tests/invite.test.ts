import { describe, it, expect, vi } from 'vitest';
import { AutoInviteService } from '../src/invite.js';
import type { Octokit } from '@octokit/rest';

describe('AutoInviteService', () => {
  const createMockOctokit = () => {
    const listFollowersForUser = vi.fn();
    const listMembers = vi.fn();
    const listPendingInvitations = vi.fn();
    const getByUsername = vi.fn();
    const createInvitation = vi.fn();

    const paginate = vi.fn(async (method: any, params: any) => {
      if (method === listFollowersForUser) {
        return [
          { login: 'user-already-member', id: 101, html_url: 'https://github.com/user-already-member' },
          { login: 'user-already-invited', id: 102, html_url: 'https://github.com/user-already-invited' },
          { login: 'user-unrelated-org', id: 103, html_url: 'https://github.com/user-unrelated-org' },
          { login: 'user-no-company', id: 104, html_url: 'https://github.com/user-no-company' },
          { login: 'user-soongsil-match', id: 105, html_url: 'https://github.com/user-soongsil-match' },
          { login: 'user-soogsil-typo-match', id: 106, html_url: 'https://github.com/user-soogsil-typo-match' },
          { login: 'user-korean-soongsil-match', id: 107, html_url: 'https://github.com/user-korean-soongsil-match' },
        ];
      }
      if (method === listMembers) {
        return [
          { login: 'user-already-member', id: 101 },
        ];
      }
      if (method === listPendingInvitations) {
        return [
          { login: 'user-already-invited', id: 102 },
        ];
      }
      return [];
    });

    getByUsername.mockImplementation(async ({ username }: { username: string }) => {
      const mockProfiles: Record<string, any> = {
        'user-unrelated-org': { login: 'user-unrelated-org', id: 103, company: 'Random Corp' },
        'user-no-company': { login: 'user-no-company', id: 104, company: null },
        'user-soongsil-match': { login: 'user-soongsil-match', id: 105, company: 'Soongsil University' },
        'user-soogsil-typo-match': { login: 'user-soogsil-typo-match', id: 106, company: 'Soogsil University' },
        'user-korean-soongsil-match': { login: 'user-korean-soongsil-match', id: 107, company: '숭실대학교 IT대학' },
      };
      return { data: mockProfiles[username] || { login: username, id: 999, company: null } };
    });

    createInvitation.mockResolvedValue({ status: 201 });

    const octokitMock = {
      paginate,
      rest: {
        users: {
          listFollowersForUser,
          getByUsername,
        },
        orgs: {
          listMembers,
          listPendingInvitations,
          createInvitation,
        },
      },
    } as unknown as Octokit;

    return {
      octokitMock,
      listFollowersForUser,
      listMembers,
      listPendingInvitations,
      getByUsername,
      createInvitation,
    };
  };

  it('should invite eligible users and skip members, invited, or non-matching users in production mode', async () => {
    const { octokitMock, createInvitation } = createMockOctokit();

    const service = new AutoInviteService(
      {
        org: 'Soongsil-Developers',
        token: 'fake-token',
        dryRun: false,
        delayMs: 0,
      },
      octokitMock
    );

    const summary = await service.run();

    expect(summary.totalFollowers).toBe(7);
    expect(summary.alreadyMembers).toBe(1);
    expect(summary.alreadyInvited).toBe(1);
    expect(summary.companyMatched).toBe(3);

    // Invited users
    expect(summary.invited).toHaveLength(3);
    expect(summary.invited.map((u) => u.login)).toEqual([
      'user-soongsil-match',
      'user-soogsil-typo-match',
      'user-korean-soongsil-match',
    ]);
    expect(summary.invited.every((u) => u.status === 'invited')).toBe(true);

    // Skipped users check
    const skippedReasons = summary.skipped.reduce((acc, curr) => {
      acc[curr.reason] = (acc[curr.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(skippedReasons['already_member']).toBe(1);
    expect(skippedReasons['already_invited']).toBe(1);
    expect(skippedReasons['company_mismatch']).toBe(1);
    expect(skippedReasons['no_company']).toBe(1);

    // Verify createInvitation API calls
    expect(createInvitation).toHaveBeenCalledTimes(3);
    expect(createInvitation).toHaveBeenCalledWith({
      org: 'Soongsil-Developers',
      invitee_id: 105,
      role: 'direct_member',
    });
    expect(createInvitation).toHaveBeenCalledWith({
      org: 'Soongsil-Developers',
      invitee_id: 106,
      role: 'direct_member',
    });
    expect(createInvitation).toHaveBeenCalledWith({
      org: 'Soongsil-Developers',
      invitee_id: 107,
      role: 'direct_member',
    });
  });

  it('should NOT call createInvitation when dryRun is true', async () => {
    const { octokitMock, createInvitation } = createMockOctokit();

    const service = new AutoInviteService(
      {
        org: 'Soongsil-Developers',
        token: 'fake-token',
        dryRun: true,
        delayMs: 0,
      },
      octokitMock
    );

    const summary = await service.run();

    expect(summary.dryRun).toBe(true);
    expect(summary.invited).toHaveLength(3);
    expect(summary.invited.every((u) => u.status === 'dry_run')).toBe(true);
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('should record failures gracefully when invitation API fails', async () => {
    const { octokitMock, createInvitation } = createMockOctokit();
    createInvitation.mockRejectedValue(new Error('Rate limit or invitation quota exceeded'));

    const service = new AutoInviteService(
      {
        org: 'Soongsil-Developers',
        token: 'fake-token',
        dryRun: false,
        delayMs: 0,
      },
      octokitMock
    );

    const summary = await service.run();

    expect(summary.invited).toHaveLength(0);
    expect(summary.failed).toHaveLength(3);
    expect(summary.failed[0].error).toContain('Rate limit or invitation quota exceeded');
  });
});
