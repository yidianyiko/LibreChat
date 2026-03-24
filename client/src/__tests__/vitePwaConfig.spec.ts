import fs from 'fs';
import path from 'path';

describe('vite PWA config', () => {
  const viteConfigPath = path.resolve(__dirname, '../../vite.config.ts');
  const viteConfigSource = fs.readFileSync(viteConfigPath, 'utf8');

  it('does not keep a persistent service worker in production', () => {
    expect(viteConfigSource).toContain('selfDestroying: true');
  });

  it('does not precache HTML documents', () => {
    expect(viteConfigSource).not.toContain('**/*.{css,html}');
  });
});
