import { issueGlobalKey } from '../../../../scripts/issue-global-purchase-key';
import { mkdtemp, readFile, stat, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
describe('Protected central key provisioning for Global', () => {
  let dir: string;
  const row = { id: 4, name: 'Global', currency: 'USD', status: 'ACTIVE' };
  function database(value: any = row) {
    const tx = {
      reseller: { findUnique: jest.fn().mockResolvedValue(value) },
      resellerApiKey: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    return { ...tx, $transaction: jest.fn((fn) => fn(tx)) };
  }
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'jetsim-key-test-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));
  it('creates one key hash and an exclusive 0600 file without returning the secret', async () => {
    const db = database(),
      path = join(dir, 'global.env');
    const result = await issueGlobalKey(db, 4, 'Global', path);
    expect(result).toEqual({ company_id: 4, name: 'Global', currency: 'USD', file: path });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    const contents = await readFile(path, 'utf8');
    expect(contents).toMatch(
      /^CENTRAL_B2B_COMPANY_ID=4\nCENTRAL_B2B_RESELLER_KEY=jrk_[0-9a-f]{8}_[A-Za-z0-9_-]{43}\n$/,
    );
    expect(db.resellerApiKey.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(db.resellerApiKey.create.mock.calls)).not.toContain(
      contents.split('CENTRAL_B2B_RESELLER_KEY=')[1].trim(),
    );
    await expect(issueGlobalKey(db, 4, 'Global', path)).rejects.toMatchObject({ code: 'EEXIST' });
    expect(db.resellerApiKey.create).toHaveBeenCalledTimes(1);
  });
  it('never creates credentials for a mismatched, blocked or non-USD company', async () => {
    for (const value of [{ ...row, name: 'Other' }, { ...row, currency: 'RUB' }, { ...row, status: 'BLOCKED' }, null]) {
      const db = database(value);
      await expect(issueGlobalKey(db, 4, 'Global', join(dir, 'no.env'))).rejects.toThrow();
      expect(db.resellerApiKey.create).not.toHaveBeenCalled();
    }
  });
});
