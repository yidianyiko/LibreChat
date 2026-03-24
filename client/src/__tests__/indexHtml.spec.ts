import fs from 'fs';
import path from 'path';

describe('client index.html', () => {
  const indexHtmlPath = path.resolve(__dirname, '../../index.html');
  const indexHtmlSource = fs.readFileSync(indexHtmlPath, 'utf8');

  it('does not preload local Inter font files from the static shell', () => {
    expect(indexHtmlSource).not.toContain('/fonts/Inter-Regular.woff2');
    expect(indexHtmlSource).not.toContain('/fonts/Inter-SemiBold.woff2');
    expect(indexHtmlSource).not.toContain('/fonts/Inter-Bold.woff2');
  });
});
