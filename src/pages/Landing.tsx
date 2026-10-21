import { APPS } from '../apps/registry';
import { Marquee } from '../components/Marquee';
import { Footer } from './landing/Footer';
import { Hero } from './landing/Hero';
import { IndexSection } from './landing/IndexSection';
import { LiveDemo } from './landing/LiveDemo';
import { OpenSource } from './landing/OpenSource';
import { StudyKit } from './landing/StudyKit';
import { Steps } from './landing/Steps';
import { TopBar } from './landing/TopBar';

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
        <StudyKit />
        <Steps />
        <OpenSource />
      </main>
      <Footer />
    </>
  );
}
