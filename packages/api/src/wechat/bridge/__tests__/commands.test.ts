import { parseWeChatCommand } from '../commands';

describe('parseWeChatCommand', () => {
  it('parses /new', () => {
    expect(parseWeChatCommand('/new')).toEqual({ name: 'new' });
  });

  it('parses /list', () => {
    expect(parseWeChatCommand('/list')).toEqual({ name: 'list' });
  });

  it('parses /switch with a numeric index', () => {
    expect(parseWeChatCommand('/switch 3')).toEqual({ name: 'switch', index: 3 });
  });

  it('parses /now', () => {
    expect(parseWeChatCommand('/now')).toEqual({ name: 'now' });
  });

  it('returns null for plain text', () => {
    expect(parseWeChatCommand('hello there')).toBeNull();
  });
});
