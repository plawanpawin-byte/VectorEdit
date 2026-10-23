import { describe, expect, it } from 'vitest';
import { recordStep, startRecording, stopRecording } from '../src/raster/macro';
import { getState } from '../src/store';

describe('macro recorder', () => {
  it('ignores steps while not recording', () => {
    recordStep('blur', { radius: 3 });
    expect(stopRecording()).toEqual([]);
  });
  it('captures steps in order and copies params', () => {
    startRecording();
    const p = { radius: 3 };
    recordStep('gaussian-blur', p);
    p.radius = 99;
    recordStep('invert', {});
    expect(getState().macroSteps).toBe(2);
    const steps = stopRecording();
    expect(steps.map((s) => s.op)).toEqual(['gaussian-blur', 'invert']);
    expect(steps[0].params.radius).toBe(3);
    expect(getState().macroRecording).toBe(false);
  });
});
