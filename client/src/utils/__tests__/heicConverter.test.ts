import { isLikelyHeicFile } from '../heicConverter';

describe('heicConverter helpers', () => {
  it('should detect HEIC file by mime type', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/heic' });
    expect(isLikelyHeicFile(file)).toBe(true);
  });

  it('should detect HEIC file by extension', () => {
    const file = new File(['x'], 'photo.HEIF', { type: '' });
    expect(isLikelyHeicFile(file)).toBe(true);
  });

  it('should return false for non-heic files', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    expect(isLikelyHeicFile(file)).toBe(false);
  });
});
