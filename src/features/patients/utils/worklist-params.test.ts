import { describe, expect, it } from 'vitest';
import {
  readWorklistParams,
  writeWorklistParams,
  worklistReturnPath,
} from './worklist-params';
describe('worklist URL contract', () => {
  it('defaults to twenty rows and latest updates first', () =>
    expect(readWorklistParams(new URLSearchParams())).toMatchObject({
      page: 1,
      pageSize: 20,
      sortBy: 'lastUpdated',
      sortOrder: 'desc',
    }));
  it('keeps valid filters while independently defaulting invalid fields', () => {
    const result = readWorklistParams(
      new URLSearchParams(
        'page=-1&pageSize=25&status=bad&state=CO&sortBy=email&sortOrder=sideways&search=Avery',
      ),
    );
    expect(result).toMatchObject({
      page: 1,
      pageSize: 20,
      state: 'CO',
      search: 'Avery',
      sortBy: 'lastUpdated',
      sortOrder: 'desc',
    });
    expect(result.status).toBeUndefined();
  });
  it('discards repeated parameters and unknown keys', () => {
    const params = readWorklistParams(
      new URLSearchParams('status=active&status=inactive&unknown=x'),
    );
    expect(writeWorklistParams(params).toString()).toBe('');
  });
  it('round trips supported controls with compact defaults', () => {
    const params = readWorklistParams(
      new URLSearchParams(
        'page=2&pageSize=50&status=active&state=TX&search=Casey&coordinatorId=coordinator-002&sortBy=age&sortOrder=asc',
      ),
    );
    expect(readWorklistParams(writeWorklistParams(params))).toEqual(params);
    expect(
      writeWorklistParams(readWorklistParams(new URLSearchParams())).toString(),
    ).toBe('');
  });
  it('keeps return links within the worklist and validates untrusted history state', () => {
    expect(
      worklistReturnPath({ worklistSearch: '?status=active&page=2' }),
    ).toBe('/patients?page=2&status=active');
    expect(worklistReturnPath({ worklistSearch: 'https://example.com' })).toBe(
      '/patients',
    );
    expect(worklistReturnPath(null)).toBe('/patients');
  });
});
