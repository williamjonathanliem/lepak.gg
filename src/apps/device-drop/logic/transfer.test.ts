import {
  Assembler,
  chunkCount,
  deviceName,
  formatBytes,
  parseControl,
  safeName,
  speedAndEta,
} from './transfer';

describe('control messages', () => {
  it('accepts good messages and rejects junk', () => {
    expect(parseControl('{"t":"end","id":"a"}')).toEqual({ t: 'end', id: 'a' });
    expect(parseControl('{"t":"file","id":"a","name":"x","size":-1,"mime":""}')).toBeNull();
    expect(parseControl('{"t":"hack"}')).toBeNull();
    expect(parseControl('not json')).toBeNull();
  });
});

describe('Assembler', () => {
  it('builds a file from chunks', async () => {
    const a = new Assembler();
    expect(
      a.control({ t: 'file', id: 'f', name: 'hi.txt', size: 5, mime: 'text/plain' }),
    ).toMatchObject({
      type: 'start',
      name: 'hi.txt',
    });
    expect(a.chunk(new TextEncoder().encode('hel').buffer)).toEqual({ id: 'f', got: 3 });
    expect(a.chunk(new TextEncoder().encode('lo').buffer)).toEqual({ id: 'f', got: 5 });
    const done = a.control({ t: 'end', id: 'f' });
    expect(done.type).toBe('file');
    if (done.type === 'file') expect(await done.blob.text()).toBe('hello');
  });

  it('rejects too many bytes, a short file, and chunks with no file', () => {
    const a = new Assembler();
    expect(a.chunk(new ArrayBuffer(4))).toBeNull();
    a.control({ t: 'file', id: 'f', name: 'x', size: 2, mime: '' });
    expect(a.chunk(new ArrayBuffer(3))).toBeNull();
    a.chunk(new ArrayBuffer(1));
    expect(a.control({ t: 'end', id: 'f' })).toEqual({ type: 'bad' });
  });

  it('drops a cancelled file', () => {
    const a = new Assembler();
    a.control({ t: 'file', id: 'f', name: 'x', size: 2, mime: '' });
    expect(a.control({ t: 'cancel', id: 'f' })).toEqual({ type: 'cancel', id: 'f' });
    expect(a.chunk(new ArrayBuffer(1))).toBeNull();
  });
});

describe('helpers', () => {
  it('cleans file names', () => {
    expect(safeName('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(safeName('a<b>.png')).toBe('a_b_.png');
    expect(safeName('...')).toBe('file');
    expect(safeName('')).toBe('file');
  });

  it('counts chunks, formats sizes and works out speed', () => {
    expect(chunkCount(0)).toBe(1);
    expect(chunkCount(64 * 1024 + 1)).toBe(2);
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB');
    expect(speedAndEta(0, 100, 0, 1000)).toEqual({ speed: 0, eta: null });
    expect(speedAndEta(50, 100, 0, 1000)).toEqual({ speed: 50, eta: 1 });
  });

  it('names devices', () => {
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iPhone');
    expect(deviceName('Mozilla/5.0 (Linux; Android 14) Mobile')).toBe('Android phone');
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows PC');
  });
});
