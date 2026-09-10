import { describe, expect, it } from 'vitest';
import { READING_BATCH_SIZE, READING_TESTS, checkSentence, readingLibrary } from '@tracker/shared';
import { mobileconfig } from '../src/lib/nextdns';

describe('sentence rules', () => {
  const ex = 'Planting trees helps mitigate the effects of air pollution.';
  it('accepts a real sentence using the word in any form', () => {
    expect(checkSentence('mitigate', ex, 'Governments can mitigate traffic problems by building more cycle lanes.').ok).toBe(true);
    expect(checkSentence('mitigate', ex, 'The new law mitigated the damage caused by the floods last spring.').ok).toBe(true);
  });
  it('rejects short, copied, foreign or word-less sentences', () => {
    expect(checkSentence('mitigate', ex, 'Mitigate this.').reason).toBe('short');
    expect(checkSentence('mitigate', ex, 'Planting trees helps to mitigate the effects of the air pollution.').reason).toBe('copy');
    expect(checkSentence('mitigate', ex, 'Это предложение написано по-русски и слово mitigate тут есть.').reason).toBe('language');
    expect(checkSentence('mitigate', ex, 'This sentence is long enough but it does not contain the target.').reason).toBe('missing');
  });
  it('handles phrasal verbs by their key words', () => {
    expect(checkSentence('phase out', 'x', 'The city will phase out diesel buses by the end of the decade.').ok).toBe(true);
  });
});

describe('reading library', () => {
  it('releases tests in batches', () => {
    expect(READING_TESTS.length).toBe(16);
    expect(readingLibrary(1).map((t) => t.id)).toEqual(['rt-01', 'rt-02', 'rt-03', 'rt-04']);
    expect(readingLibrary(2).length).toBe(2 * READING_BATCH_SIZE);
    expect(readingLibrary(99).length).toBe(READING_TESTS.length);
  });
});

describe('mobileconfig', () => {
  it('is a plist with a DoH payload and a removal password', () => {
    const x = mobileconfig('abc123', 'IELTS-1', '654321');
    expect(x).toContain('<key>DNSProtocol</key><string>HTTPS</string>');
    expect(x).toContain('https://dns.nextdns.io/abc123/IELTS-1');
    expect(x).toContain('com.apple.profileRemovalPassword');
    expect(x).toContain('<key>RemovalPassword</key><string>654321</string>');
  });
});
