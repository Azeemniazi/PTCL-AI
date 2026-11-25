import { Brand, Icon } from '../shared/Brand';

const navigation = [
  ['site-solutions', 'Solutions'], ['site-ai', 'AI Workspace'], ['site-industries', 'Industries'],
  ['site-resources', 'Resources'], ['site-about', 'About'],
] as const;
const services = [
  ['chat', 'AI Workspace', 'Chat, meet and get insights — all in one place.', 'site-ai'],
  ['shield', 'Enterprise Security', 'Your data. Your priority. Built for trust at scale.', 'site-about'],
  ['file', 'Document Intelligence', 'Understand, compare and extract insights instantly.', 'site-solutions'],
  ['chart', 'Real Impact', 'Turn information into your next business decision.', 'site-industries'],
] as const;

export function Landing({ signedIn }: { signedIn: boolean }) {
  const destination = signedIn ? '#home' : '#login';
  return <div className="ref-landing">
    <header className="ref-site-header"><Brand />
      <nav aria-label="Main navigation">{navigation.map(([path, label]) => <a key={path} href={'#' + path}>{label}</a>)}</nav>
      <div className="ref-site-actions">
        <a href="#site-resources" aria-label="Search resources"><Icon name="search" /></a>
        <a className="ref-glass-button" href={destination}>{signedIn ? 'Workspace' : 'Sign in'}</a>
        <a className="ref-lime-button" href={destination}>Get Started <Icon name="arrow" /></a>
      </div>
    </header>
    <main>
      <section className="ref-landing-hero">
        <span className="ref-kicker">AI FOR A BRIGHTER TOMORROW</span>
        <h1>A Smarter<br /><span>Connected</span><br /><em>Pakistan</em></h1>
        <h2>Secure. Intelligent. Built for what’s next.</h2>
        <p>CloudCore AI brings people, information and ideas together — helping organizations work smarter, faster and more securely.</p>
        <div className="ref-hero-actions">
          <a className="ref-lime-button" href={destination}>Explore AI Workspace <Icon name="arrow" /></a>
          <a className="ref-watch" href="#site-ai"><span><Icon name="play" /></span>Discover CloudCore AI</a>
        </div>
      </section>
      <section className="ref-service-strip">{services.map(([icon, title, description, path]) =>
        <a key={title} href={'#' + path}><span className="ref-dark-icon"><Icon name={icon} /></span>
          <div><b>{title}</b><p>{description}</p></div><span className="ref-round-arrow"><Icon name="arrow" /></span>
        </a>)}
      </section>
      <footer className="ref-landing-footer">
        <span>A product of<br /><b>PTCL Smart Cloud</b></span><span>Grounded answers</span><span>Meeting intelligence</span>
        <span>Document &amp; image insight</span><a href="#site-solutions">Scroll to explore <Icon name="arrow" /></a>
      </footer>
    </main>
  </div>;
}
