import { describe, expect, it } from 'vitest';
import { nextTokenSelection } from '../../src/features/campaign/tokenSelection';

describe('token selection', () => {
  it('replaces selection for a regular click', () => {
    expect(nextTokenSelection(['a', 'b'], 'c', false)).toEqual(['c']);
  });

  it('adds a token once for an additive click', () => {
    expect(nextTokenSelection(['a'], 'b', true)).toEqual(['a', 'b']);
  });

  it('removes an already selected token for an additive click', () => {
    expect(nextTokenSelection(['a', 'b'], 'a', true)).toEqual(['b']);
  });

  it('does not mutate the current selection', () => {
    const current = ['a'];

    nextTokenSelection(current, 'b', true);

    expect(current).toEqual(['a']);
  });
});
