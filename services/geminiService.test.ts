import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateGameSpritesheet } from './geminiService';

describe('Gemini Service', () => {
  const fetchMock = vi.fn();
  
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fallback to preset if words array length is not exactly 4', async () => {
    const result = await generateGameSpritesheet(['One', 'Two']);
    expect(result).toBe('/presets/copa-ropa-sopa-loca.webp');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should return URL on successful API call', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://storage.example.com/test.webp', cached: false })
    });

    const words = ['A', 'B', 'C', 'D'];
    const result = await generateGameSpritesheet(words);

    expect(fetchMock).toHaveBeenCalledWith('/api/spritesheet', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ words })
    }));
    expect(result).toBe('https://storage.example.com/test.webp');
  });

  it('should throw Error with server message if API call fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Profanity detected' })
    });

    await expect(generateGameSpritesheet(['A', 'B', 'C', 'D'])).rejects.toThrow('Profanity detected');
  });
});