import { describe, expect, it } from 'vitest';
import { fill, parseCsv, placeholders } from '../src/datamerge';

describe('data merge', () => {
  it('parses quoted fields, embedded commas, quotes and newlines', () => {
    const { fields, rows } = parseCsv('Name,Role\r\n"Smith, Ann","She said ""hi"""\n"Lee","line1\nline2"\n');
    expect(fields).toEqual(['Name', 'Role']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Name: 'Smith, Ann', Role: 'She said "hi"' });
    expect(rows[1].Role).toBe('line1\nline2');
  });
  it('detects semicolons and tabs, skips blank lines and the BOM', () => {
    expect(parseCsv('﻿a;b\n1;2\n\n3;4').rows).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
    expect(parseCsv('a\tb\n1\t2').rows[0]).toEqual({ a: '1', b: '2' });
    expect(parseCsv('').rows).toEqual([]);
  });
  it('fills placeholders case-insensitively and leaves unknown ones', () => {
    expect(fill('Hi {{ name }}, {{Unknown}}!', { Name: 'Ann' })).toBe('Hi Ann, {{Unknown}}!');
  });
  it('lists placeholder names once', () => {
    expect(placeholders(['{{a}} {{b}}', '{{a}}'])).toEqual(['a', 'b']);
  });
});
