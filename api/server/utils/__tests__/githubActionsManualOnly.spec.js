const fs = require('fs');
const path = require('path');

const workflowsDir = path.resolve(__dirname, '../../../../.github/workflows');

function getOnBlock(source) {
  const lines = source.split('\n');
  const onIndex = lines.findIndex((line) => line.trim() === 'on:');

  if (onIndex === -1) {
    return '';
  }

  const block = ['on:'];

  for (let i = onIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      block.push(line);
      continue;
    }

    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      break;
    }

    block.push(line);
  }

  return block.join('\n');
}

describe('GitHub workflows', () => {
  const workflowFiles = fs
    .readdirSync(workflowsDir)
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .sort();

  test.each(workflowFiles)('%s is manual-only', (workflowFile) => {
    const workflowPath = path.join(workflowsDir, workflowFile);
    const workflowSource = fs.readFileSync(workflowPath, 'utf8');
    const onBlock = getOnBlock(workflowSource);

    expect(onBlock).toContain('workflow_dispatch:');
    expect(onBlock).not.toMatch(/^\s+push:\s*$/m);
    expect(onBlock).not.toMatch(/^\s+pull_request:\s*$/m);
    expect(onBlock).not.toMatch(/^\s+workflow_run:\s*$/m);
    expect(onBlock).not.toMatch(/^\s+repository_dispatch:\s*$/m);
    expect(onBlock).not.toMatch(/^\s+schedule:\s*$/m);
  });
});
