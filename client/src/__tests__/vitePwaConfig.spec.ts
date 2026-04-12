import fs from 'fs';
import path from 'path';

describe('vite PWA config', () => {
  const viteConfigPath = path.resolve(__dirname, '../../vite.config.ts');
  const viteConfigSource = fs.readFileSync(viteConfigPath, 'utf8');

  it('keeps the production service worker active', () => {
    expect(viteConfigSource).toContain('selfDestroying: false');
  });

  it('does not precache HTML documents', () => {
    expect(viteConfigSource).not.toContain('**/*.{css,html}');
  });

  it('uses prompt-based update handling instead of automatic reloads', () => {
    expect(viteConfigSource).toContain("registerType: 'prompt'");
  });
});
