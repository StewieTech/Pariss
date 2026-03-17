export const SUPPORTED_LANGUAGES = [
  'spanish',
  'french',
  'japanese',
  'german',
  'mandarin',
  'portuguese',
  'italian',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'spanish';

export function normalizeLanguage(value: unknown): SupportedLanguage {
  const raw = String(value || '').trim().toLowerCase();

  switch (raw) {
    case 'french':
    case 'fr':
      return 'french';
    case 'spanish':
    case 'es':
      return 'spanish';
    case 'japanese':
    case 'ja':
      return 'japanese';
    case 'german':
    case 'de':
      return 'german';
    case 'mandarin':
    case 'chinese':
    case 'zh':
    case 'zh-cn':
      return 'mandarin';
    case 'portuguese':
    case 'pt':
      return 'portuguese';
    case 'italian':
    case 'it':
      return 'italian';
    default:
      return DEFAULT_LANGUAGE;
  }
}

export function formatLanguageLabel(language: SupportedLanguage): string {
  return language.charAt(0).toUpperCase() + language.slice(1);
}
