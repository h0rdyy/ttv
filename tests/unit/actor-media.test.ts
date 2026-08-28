import { describe, expect, it } from 'vitest';
import { actorMedia, actorMediaUrl } from '../../src/features/campaign/actorMedia';

describe('actor media', () => {
  it('uses safe defaults when actor media is absent', () => {
    expect(actorMedia({})).toEqual({
      avatarPath: null,
      tokenPath: null,
      tokenScale: 1,
      tokenOffsetX: 0,
      tokenOffsetY: 0,
    });
  });

  it('reads separate sheet avatar and tabletop token settings', () => {
    expect(actorMedia({
      _media: {
        avatar_path: 'campaign/actor/avatar/a.webp',
        token_path: 'campaign/actor/token/t.png',
        token_scale: '1.35',
        token_offset_x: -12,
        token_offset_y: 18,
      },
    })).toEqual({
      avatarPath: 'campaign/actor/avatar/a.webp',
      tokenPath: 'campaign/actor/token/t.png',
      tokenScale: 1.35,
      tokenOffsetX: -12,
      tokenOffsetY: 18,
    });
  });

  it('clamps unsafe token presentation values', () => {
    expect(actorMedia({
      _media: {
        token_scale: 99,
        token_offset_x: -200,
        token_offset_y: 200,
      },
    })).toMatchObject({
      tokenScale: 2.5,
      tokenOffsetX: -50,
      tokenOffsetY: 50,
    });
  });

  it('only builds authenticated media URLs when a path exists', () => {
    expect(actorMediaUrl('campaign id', 'actor/id', 'avatar', null)).toBeNull();
    expect(actorMediaUrl('campaign id', 'actor/id', 'token', 'folder/token image.webp'))
      .toBe('/api/campaign/campaign%20id/actor/actor%2Fid/media/token?v=folder%2Ftoken%20image.webp');
  });
});
