import { describe, it, expect } from 'vitest';
import { isCompanyMatching, normalizeCompany } from '../src/matcher.js';

describe('normalizeCompany', () => {
  it('should trim and lowercase company string', () => {
    expect(normalizeCompany('  Soongsil University  ')).toBe('soongsil university');
  });

  it('should collapse multiple whitespaces into a single space', () => {
    expect(normalizeCompany('Soongsil    \n\t  University')).toBe('soongsil university');
  });
});

describe('isCompanyMatching', () => {
  it('should return false for null, undefined, or empty string', () => {
    expect(isCompanyMatching(null)).toBe(false);
    expect(isCompanyMatching(undefined)).toBe(false);
    expect(isCompanyMatching('')).toBe(false);
    expect(isCompanyMatching('   ')).toBe(false);
  });

  describe('Soongsil variations', () => {
    it('should match "Soongsil University"', () => {
      expect(isCompanyMatching('Soongsil University')).toBe(true);
      expect(isCompanyMatching('SOONGSIL UNIVERSITY')).toBe(true);
      expect(isCompanyMatching('soongsil university')).toBe(true);
    });

    it('should match "Soongsil Univ." and "Soongsil Univ"', () => {
      expect(isCompanyMatching('Soongsil Univ.')).toBe(true);
      expect(isCompanyMatching('Soongsil Univ')).toBe(true);
      expect(isCompanyMatching('Soongsil Univ. CSE / SWM 14th / BoB 15th')).toBe(true);
      expect(isCompanyMatching('@yourssu, Soongsil Univ CSE')).toBe(true);
    });

    it('should match standalone or prefixed "Soongsil"', () => {
      expect(isCompanyMatching('Soongsil')).toBe(true);
      expect(isCompanyMatching('@Soongsil')).toBe(true);
      expect(isCompanyMatching('Soongsil AI Lab')).toBe(true);
    });

    it('should match user-provided typo "Soogsil"', () => {
      expect(isCompanyMatching('Soogsil University')).toBe(true);
      expect(isCompanyMatching('Soogsil')).toBe(true);
    });
  });

  describe('SSU and ssu variations', () => {
    it('should match standalone "SSU" and "ssu"', () => {
      expect(isCompanyMatching('SSU')).toBe(true);
      expect(isCompanyMatching('ssu')).toBe(true);
      expect(isCompanyMatching('Ssu')).toBe(true);
    });

    it('should match "SSU" with punctuation or word boundaries', () => {
      expect(isCompanyMatching('@SSU')).toBe(true);
      expect(isCompanyMatching('SSU CSE')).toBe(true);
      expect(isCompanyMatching('Student at SSU')).toBe(true);
      expect(isCompanyMatching('SSU, Computer Science')).toBe(true);
      expect(isCompanyMatching('ssu.ac.kr')).toBe(true);
      expect(isCompanyMatching('[SSU] Software')).toBe(true);
    });

    it('should NOT match words containing ssu as part of other words', () => {
      expect(isCompanyMatching('issue')).toBe(false);
      expect(isCompanyMatching('tissue')).toBe(false);
      expect(isCompanyMatching('Assurance Corp')).toBe(false);
      expect(isCompanyMatching('Passive Issue Tracker')).toBe(false);
    });
  });

  describe('Korean variations', () => {
    it('should match "숭실대학교" and "숭실대"', () => {
      expect(isCompanyMatching('숭실대학교')).toBe(true);
      expect(isCompanyMatching('숭실대')).toBe(true);
      expect(isCompanyMatching('숭실대학교 금융학부')).toBe(true);
    });
  });

  describe('Unrelated companies', () => {
    it('should reject unrelated companies', () => {
      expect(isCompanyMatching('Seoul National University')).toBe(false);
      expect(isCompanyMatching('KAIST')).toBe(false);
      expect(isCompanyMatching('Google')).toBe(false);
      expect(isCompanyMatching('@naver')).toBe(false);
      expect(isCompanyMatching('SanDisk')).toBe(false);
    });
  });

  describe('Custom matcher options', () => {
    it('should allow custom regex override', () => {
      const options = {
        regex: /^CustomCollege$/i,
      };
      expect(isCompanyMatching('CustomCollege', options)).toBe(true);
      expect(isCompanyMatching('Soongsil University', options)).toBe(false);
    });

    it('should allow custom substring keywords', () => {
      const options = {
        substringKeywords: ['custom-org'],
        acronymKeywords: [],
      };
      expect(isCompanyMatching('custom-org team', options)).toBe(true);
      expect(isCompanyMatching('Soongsil', options)).toBe(false);
    });
  });
});
