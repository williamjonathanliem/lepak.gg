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

  it('puts AI apps side by side at the front of their group', () => {
    const study = groupedApps().find((g) => g.id === 'study')!;
    const ai = study.apps.map((a) => !!a.ai);
    const firstNonAi = ai.indexOf(false);
    expect(ai.slice(firstNonAi).includes(true)).toBe(false);
    expect(firstNonAi).toBeGreaterThan(0);
  });
});
