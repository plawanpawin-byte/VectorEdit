import { describe, expect, it } from 'vitest';
import { runScript } from '../src/scripting';
import { getState, newDocument, undo } from '../src/store';

describe('scripting', () => {
  it('adds shapes as one undo step', () => {
    newDocument();
    const before = getState().shapes.length;
    const r = runScript(`for (let i=0;i<3;i++) app.add('rect',{x:i*10}); app.log('n', app.shapes().length);`);
    expect(r.ok).toBe(true);
    expect(getState().shapes.length).toBe(before + 3);
    expect(r.logs[0]).toBe(`n ${before + 3}`);
    undo();
    expect(getState().shapes.length).toBe(before);
  });
  it('reports errors without throwing', () => {
    const r = runScript('throw new Error("boom")');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('boom');
  });
});
