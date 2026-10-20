import { SITE } from './site';

/** Link into the GitHub repo, or the on-page Source section until the repo URL is set. */
export function repoHref(path = ''): string {
  return SITE.repoUrl.startsWith('http') ? `${SITE.repoUrl.replace(/\/$/, '')}${path}` : '#open';
}
