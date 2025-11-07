import { sanitizeVariant } from '../../app/lib/utils';

describe('sanitizeVariant', () => {
  test('removes code fences and returns inner content', () => {
    const input = '```fr\nBonjour\n```';
    expect(sanitizeVariant(input)).toBe('Bonjour');
  });

  test('parses JSON array and returns first element', () => {
    const input = '["Salut","Bonjour"]';
    expect(sanitizeVariant(input)).toBe('Salut');
  });

  test('removes surrounding quotes', () => {
    expect(sanitizeVariant('"Bonjour"')).toBe('Bonjour');
    expect(sanitizeVariant("'Salut'")).toBe('Salut');
  });

  test('removes labeled prefixes', () => {
    expect(sanitizeVariant('Casual: Salut')).toBe('Salut');
    expect(sanitizeVariant('Formal: Bonjour')).toBe('Bonjour');
  });

  test('handles empty or falsy input', () => {
    expect(sanitizeVariant('')).toBe('');
    // @ts-ignore
    expect(sanitizeVariant(null)).toBe('');
  });
});
