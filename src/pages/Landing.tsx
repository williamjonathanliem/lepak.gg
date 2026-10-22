import { APPS } from '../apps/registry';
import { Marquee } from '../components/Marquee';
import { Footer } from './landing/Footer';
import { ForClass } from './landing/ForClass';
import { Hero } from './landing/Hero';
import { IndexSection } from './landing/IndexSection';
import { LiveDemo } from './landing/LiveDemo';
import { OpenSource } from './landing/OpenSource';
import { TopBar } from './landing/TopBar';
import { Wall } from './landing/Wall';

export default function Landing() {
  return (
    <>
      <title>Lepak.gg</title>
      <TopBar />
      <main>
        <Hero />
        <Marquee items={APPS.map((app) => app.name)} />
        <LiveDemo />
        <IndexSection />
        <Wall />
        <ForClass />
        <OpenSource />
      </main>
      <Footer />
    </>
  );
}
