import { splitJsonArrayIntoChunks } from './importChunker';

describe('splitJsonArrayIntoChunks', () => {
  it('returns a single chunk when data is under the threshold', () => {
    const data = [{ title: 'conv1' }, { title: 'conv2' }];
    const chunks = splitJsonArrayIntoChunks(data, 1024 * 1024); // 1MB
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(data);
  });

  it('splits into multiple chunks when data exceeds threshold', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      title: `Conversation ${i}`,
      mapping: { id: `msg-${i}` },
    }));
    const chunks = splitJsonArrayIntoChunks(data, 100);
    expect(chunks.length).toBeGreaterThan(1);
    const allConvos = chunks.flat();
    expect(allConvos).toHaveLength(10);
  });

  it('handles a single conversation that exceeds the threshold', () => {
    const bigConvo = { title: 'big', data: 'x'.repeat(200) };
    const chunks = splitJsonArrayIntoChunks([bigConvo], 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual([bigConvo]);
  });

  it('returns empty array for empty input', () => {
    const chunks = splitJsonArrayIntoChunks([], 1024);
    expect(chunks).toHaveLength(0);
  });

  it('preserves conversation order across chunks', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const chunks = splitJsonArrayIntoChunks(data, 50);
    const allIds = chunks.flat().map((c: any) => c.id);
    expect(allIds).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});
