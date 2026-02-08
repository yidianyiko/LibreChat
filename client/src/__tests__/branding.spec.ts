import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..', '..');
const localesRoot = path.join(projectRoot, 'src', 'locales');

const uiFiles = [
  path.join(projectRoot, 'src', 'demo', 'demoData.ts'),
  path.join(projectRoot, 'src', 'components', 'Chat', 'Footer.tsx'),
  path.join(projectRoot, 'src', 'components', 'Agents', 'Marketplace.tsx'),
  path.join(projectRoot, 'vite.config.ts'),
];

const readFile = (filePath: string) => fs.readFileSync(filePath, 'utf8');

describe('branding', () => {
  test('ui text files do not mention LibreChat', () => {
    for (const filePath of uiFiles) {
      const content = readFile(filePath);
      expect(content).not.toContain('LibreChat');
    }
  });

  test('locale translations do not mention LibreChat', () => {
    const localeDirs = fs
      .readdirSync(localesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const locale of localeDirs) {
      const translationPath = path.join(localesRoot, locale, 'translation.json');
      if (!fs.existsSync(translationPath)) {
        continue;
      }
      const content = readFile(translationPath);
      expect(content).not.toContain('LibreChat');
    }
  });
});
