import { MatcherOptions } from './types.js';

export const DEFAULT_SUBSTRING_KEYWORDS = [
  'soongsil',
  'soogsil', // Handles user typo
  '숭실',    // Korean support: 숭실대, 숭실대학교
];

export const DEFAULT_ACRONYM_KEYWORDS = [
  'ssu',     // Soongsil University acronym
];

/**
 * Normalizes a company name string:
 * - Trims whitespace
 * - Converts to lower case
 * - Collapses multiple spaces into single space
 */
export function normalizeCompany(company: string): string {
  return company
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Checks if a user's company profile matches the target criteria.
 * Matches if:
 * 1. Matches custom regex if provided
 * 2. Contains any substring keywords (e.g., 'soongsil', 'soogsil', '숭실')
 * 3. Contains acronym keywords with word boundaries (e.g., 'SSU', 'ssu', '@SSU', but NOT 'issue')
 *
 * @param company - The company field from GitHub user profile
 * @param options - Matcher options
 * @returns true if matched, false otherwise
 */
export function isCompanyMatching(
  company: string | null | undefined,
  options: MatcherOptions = {}
): boolean {
  if (!company || typeof company !== 'string') {
    return false;
  }

  const trimmed = company.trim();
  if (!trimmed) {
    return false;
  }

  // 1. Custom regular expression override
  if (options.regex) {
    return options.regex.test(trimmed);
  }

  const normalized = normalizeCompany(trimmed);

  // 2. Substring matching (e.g. 'soongsil', 'soogsil', '숭실')
  const substringKeywords =
    options.substringKeywords ?? DEFAULT_SUBSTRING_KEYWORDS;

  for (const kw of substringKeywords) {
    const normKw = normalizeCompany(kw);
    if (normKw && normalized.includes(normKw)) {
      return true;
    }
  }

  // 3. Acronym boundary matching (e.g. 'ssu' or 'SSU')
  // We use word/non-alphanumeric boundaries to avoid matching words like 'issue' or 'tissue'.
  const acronymKeywords =
    options.acronymKeywords ?? DEFAULT_ACRONYM_KEYWORDS;

  if (acronymKeywords.length > 0) {
    const escaped = acronymKeywords.map((k) =>
      k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const boundaryPattern = new RegExp(
      `(^|[^a-zA-Z0-9])(${escaped.join('|')})([^a-zA-Z0-9]|$)`,
      'i'
    );
    if (boundaryPattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}
