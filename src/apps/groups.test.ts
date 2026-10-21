import { GROUPS, groupOf, groupedApps, playersLabel } from './groups';
import { APPS } from './registry';

describe('app groups', () => {
  it('puts every app in exactly one group', () => {
    const placed = groupedApps().flatMap((g) => g.apps.map((a) => a.id));
    expect([...placed].sort()).toEqual(APPS.map((a) => a.id).sort());
  });

  it('only lists real app ids', () => {
    const ids = new Set(APPS.map((a) => a.id));
    for (const g of GROUPS) for (const id of g.ids) expect(ids.has(id)).toBe(true);
  });

  it('labels who an app is for', () => {
    const app = (id: string) => APPS.find((a) => a.id === id)!;
    expect(groupOf(app('sudoku'))).toBe('daily');
    expect(playersLabel(app('sudoku'))).toBe('Daily puzzle');
    expect(playersLabel(app('ai-notes'))).toBe('Just you');
  });
});
