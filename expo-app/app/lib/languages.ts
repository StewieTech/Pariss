export const LANGUAGE_OPTIONS = [
  { code: 'spanish', label: 'Spanish', nativeLabel: 'Espanol' },
  { code: 'french', label: 'French', nativeLabel: 'Francais' },
  { code: 'japanese', label: 'Japanese', nativeLabel: 'Nihongo' },
  { code: 'german', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'mandarin', label: 'Mandarin', nativeLabel: 'Putonghua' },
  { code: 'portuguese', label: 'Portuguese', nativeLabel: 'Portugues' },
  { code: 'italian', label: 'Italian', nativeLabel: 'Italiano' },
] as const;

export type AppLanguage = (typeof LANGUAGE_OPTIONS)[number]['code'];

export const DEFAULT_LANGUAGE: AppLanguage = 'spanish';

export function getLanguageMeta(language: AppLanguage) {
  return (
    LANGUAGE_OPTIONS.find((option) => option.code === language) ??
    LANGUAGE_OPTIONS[0]
  );
}
