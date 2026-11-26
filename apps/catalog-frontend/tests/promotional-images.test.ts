import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePromotionalImageLines } from '../src/utils/promotionalImages';

test('parses up to ten promotional image URLs from separate lines', () => {
  const input = Array.from({ length: 10 }, (_, index) => `https://cdn.example.test/image-${index}.webp`).join('\n');
  const result = normalizePromotionalImageLines(input);
  assert.equal(result.valid, true);
  assert.equal(result.images.length, 10);
});

test('rejects more than ten non-empty lines', () => {
  const input = Array.from({ length: 11 }, (_, index) => `https://cdn.example.test/image-${index}.webp`).join('\n');
  assert.equal(normalizePromotionalImageLines(input).valid, false);
});

test('trims blanks and deduplicates URLs', () => {
  const result = normalizePromotionalImageLines('  https://cdn.example.test/a.webp  \n\nhttps://cdn.example.test/a.webp\nhttps://cdn.example.test/b.webp');
  assert.deepEqual(result.images, ['https://cdn.example.test/a.webp', 'https://cdn.example.test/b.webp']);
});

test('rejects non-HTTPS, credential-bearing, local and malformed URLs', () => {
  for (const input of [
    'http://cdn.example.test/a.webp',
    'https://user:pass@cdn.example.test/a.webp',
    'https://localhost/a.webp',
    'https://127.0.0.1/a.webp',
    'not-a-url',
  ]) {
    assert.equal(normalizePromotionalImageLines(input).valid, false, input);
  }
});