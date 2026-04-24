import { describe, it, expect } from 'vitest';
import { 
  toSupportedLocale, 
  getBestLocaleFromList, 
  isSupportedLocale,
  isRtlLocale
} from './config';

describe('i18n Config', () => {
  describe('toSupportedLocale', () => {
    it('should resolve exact matches', () => {
      expect(toSupportedLocale('es')).toBe('es');
      expect(toSupportedLocale('en')).toBe('en');
    });

    it('should normalize and resolve aliases with case issues', () => {
      expect(toSupportedLocale('en-US')).toBe('en');
      expect(toSupportedLocale('PT-br')).toBe('pt-BR');
      expect(toSupportedLocale('zh-HANS-cn')).toBe('zh-Hans');
      expect(toSupportedLocale('es_419')).toBe('es');
    });

    it('should fallback to base language if specific region is unmapped', () => {
      expect(toSupportedLocale('fr-BE')).toBe('fr');
      expect(toSupportedLocale('it-CH')).toBe('it');
    });

    it('should return null for completely unsupported languages', () => {
      expect(toSupportedLocale('nl')).toBeNull();
      expect(toSupportedLocale(null)).toBeNull();
      expect(toSupportedLocale('')).toBeNull();
    });
  });

  describe('getBestLocaleFromList', () => {
    it('should return the first matched locale from preferences', () => {
      const prefs = ['nl-NL', 'pt-PT', 'en-US'];
      expect(getBestLocaleFromList(prefs)).toBe('pt-BR');
    });

    it('should return the DEFAULT_LOCALE (en) if none match', () => {
      expect(getBestLocaleFromList(['nl', 'pl'])).toBe('en');
    });
  });

  describe('isRtlLocale', () => {
    it('should return true only for Arabic (ar)', () => {
      expect(isRtlLocale('ar')).toBe(true);
      expect(isRtlLocale('en')).toBe(false);
      expect(isRtlLocale('es')).toBe(false);
    });
  });

  describe('isSupportedLocale', () => {
    it('should correctly identify exact keys', () => {
      expect(isSupportedLocale('pt-BR')).toBe(true);
      expect(isSupportedLocale('pt-br')).toBe(false);
    });
  });
});