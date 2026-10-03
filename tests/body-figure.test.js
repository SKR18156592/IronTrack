import { describe, expect, it } from 'vitest';
import { mirroredOutline } from '../src/render/body-figure.js';

describe('mirroredOutline', () => {
  it('traces the half outline, then its mirror image back to the start', () => {
    expect(mirroredOutline('M60 0 C50 0 40 10 40 20 L60 30')).toBe(
      'M60 0 C50 0 40 10 40 20 L60 30 L80 20 C80 10 70 0 60 0 Z'
    );
  });
});
