import { APPS, ROUTED_APPS } from './registry';

describe('app registry', () => {
  it('has unique ids and numbers', () => {
    expect(new Set(APPS.map((a) => a.id)).size).toBe(APPS.length);
    expect(new Set(APPS.map((a) => a.number)).size).toBe(APPS.length);
  });

  it('uses 3-digit numbers', () => {
    for (const app of APPS) expect(app.number).toMatch(/^\d{3}$/);
  });

  it('gives every routed app a unique route starting with /', () => {
    const routes = ROUTED_APPS.map((a) => a.route);
    for (const r of routes) expect(r).toMatch(/^\/[a-z0-9-]+$/);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('routes the playable apps', () => {
    expect(ROUTED_APPS.map((a) => a.id)).toEqual([
      'katabomb',
      'notes',
      'wordl',
      'connections',
      'whiteboard',
      'trivia',
      'cite',
      'toolbox',
      'bingo',
    ]);
  });
});
