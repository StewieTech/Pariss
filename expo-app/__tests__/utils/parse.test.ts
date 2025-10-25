import { parseRoomIdFromRaw } from '../../app/lib/utils';

describe('parseRoomIdFromRaw', () => {
  test('extracts id from full function URL with /pvp/:id', () => {
    const url = 'https://example.com/pvp/room123';
    expect(parseRoomIdFromRaw(url)).toBe('room123');
  });

  test('extracts last path segment when no /pvp prefix', () => {
    const url = 'https://example.com/rooms/room-abc/';
    expect(parseRoomIdFromRaw(url)).toBe('room-abc');
  });

  test('sanitizes raw id with weird chars', () => {
    const raw = ' room!@#-ID_01 ';
    expect(parseRoomIdFromRaw(raw)).toBe('room-ID_01'.replace(/[^a-z0-9\-_.]/ig,''));
  });

  test('handles query strings and hashes', () => {
    const url = 'https://example.com/pvp/abc123?foo=1#bar';
    expect(parseRoomIdFromRaw(url)).toBe('abc123');
  });
});
