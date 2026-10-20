import { Link } from 'react-router';

export default function NotFound() {
  return (
    <main className="px-gutter py-16">
      <title>Not found · Lepak.gg</title>
      <p className="font-mono text-sm">{'// 404 :: NOT FOUND'}</p>
      <h1 className="heading-xl mt-6">Sesat.</h1>
      <p className="mt-6 max-w-lg text-lg">Nothing here. Wrong link, maybe.</p>
      <Link to="/" className="mt-8 inline-flex min-h-11 items-center font-mono underline">
        Go home
      </Link>
    </main>
  );
}
