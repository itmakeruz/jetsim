import { generateKey, hashSecret, parseKey, safeEqualHex } from './key-codec';

describe('key-codec', () => {
  it('сгенерированный ключ разбирается обратно, а в БД уходит только хеш секрета', () => {
    const { key, prefix, hash } = generateKey();
    const parsed = parseKey(key)!;
    expect(parsed.prefix).toBe(prefix);
    expect(hashSecret(parsed.secret)).toBe(hash);
    expect(key).not.toContain(hash);
  });

  it('два ключа различаются', () => {
    expect(generateKey().key).not.toBe(generateKey().key);
  });

  it.each([undefined, null, '', 'jrk_', 'jrk_zzzzzzzz_' + 'a'.repeat(43), 'xxx_12345678_' + 'a'.repeat(43), 12345])(
    'мусор %p не разбирается',
    (bad) => {
      expect(parseKey(bad as any)).toBeNull();
    },
  );

  it('safeEqualHex не падает на разной длине и не считает пустое равным', () => {
    expect(safeEqualHex('ab', 'abcd')).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
    expect(safeEqualHex(hashSecret('x'), hashSecret('x'))).toBe(true);
    expect(safeEqualHex(hashSecret('x'), hashSecret('y'))).toBe(false);
  });
});
