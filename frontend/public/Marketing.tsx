import { useState } from 'react';
import { Brand, Icon, Mark } from '../shared/Brand';

const pages = {
  'site-solutions': Solutions,
  'site-ai': Assistant,
  'site-industries': Industries,
  'site-resources': Resources,
  'site-about': About,
};

export type MarketingRoute = keyof typeof pages;

export function Marketing({ page, signedIn }: { page: MarketingRoute; signedIn: boolean }) {
  const Page = pages[page];
  const links = [
    ['landing', 'Home'],
    ['site-solutions', 'Solutions'],
    ['site-ai', 'AI Assistant'],
    ['site-industries', 'Industries'],
    ['site-resources', 'Resources'],
    ['site-about', 'About'],
  ];
  return (
    <div className={`marketing-page minimal-site ${page}`}>
      <header className="minimal-header">
        <Brand />
        <nav aria-label="Main navigation">
          {links.map(([id, label]) => (
            <a key={id} className={page === id ? 'active' : undefined} href={'#' + id}>
              {label}
            </a>
          ))}
        </nav>
        <div className="minimal-header-tools">
          <a className="header-search" href="#site-resources" aria-label="Search resources">
            <Icon name="search" />
          </a>
          <a className="minimal-signin" href={signedIn ? '#home' : '#login'}>
            {signedIn ? 'Open Workspace' : 'Sign In'}
          </a>
        </div>
      </header>
      <main>
        <Page />
      </main>
      <footer className="minimal-footer">
        <Brand />
        <span>Conversational AI · Enterprise RAG · Document Intelligence · Vision AI</span>
        <span>© CloudCore AI</span>
      </footer>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="product-canvas" aria-label="CloudCore AI product preview">
      <div className="product-rail">
        <div className="product-mini-brand">
          <Mark />
          <b>CloudCore AI</b>
        </div>
        <span className="selected">
          <Icon name="chat" />
          New conversation
        </span>
        <span>
          <Icon name="file" />
          Knowledge
        </span>
        <span>
          <Icon name="file" />
          Documents
        </span>
        <span>
          <Icon name="image" />
          Images
        </span>
        <span>
          <Icon name="sliders" />
          Workflows
        </span>
      </div>
      <div className="product-conversation">
        <div className="product-question">
          What are the termination terms in our cloud services agreement?
        </div>
        <div className="product-answer">
          <i></i>
          <p>
            Either party may terminate with 30 days’ written notice when a material breach remains
            uncured after the notice period.
          </p>
          <div className="source-chip">
            <Icon name="file" /> Cloud Services Agreement v2.3 · Section 12.1
          </div>
        </div>
        <div className="product-composer">
          Ask a question about your data… <Icon name="paperclip" />
        </div>
      </div>
      <aside className="product-inspector">
        <span>INSPECTOR</span>
        <b>Extracted clause</b>
        <p>
          <strong>12.1 Termination</strong>Written notice is required when a material breach remains
          uncured.
        </p>
        <b>Image insight</b>
        <div className="mini-vision">
          <Icon name="image" />
          <span>
            HVAC unit
            <br />
            <small>No visible anomaly</small>
          </span>
        </div>
      </aside>
    </div>
  );
}

function AssistantPreview() {
  return (
    <div className="assistant-canvas" aria-label="CloudCore AI Assistant preview">
      <div className="assistant-question">
        What are the termination conditions in our managed services agreement?
      </div>
      <div className="assistant-response">
        <span className="assistant-avatar">CC</span>
        <div>
          <p>The agreement may be terminated under the following conditions:</p>
          <ol>
            <li>Material breach that remains uncured for 30 days after written notice.</li>
            <li>Termination for convenience with 90 days’ written notice.</li>
            <li>Insolvency or similar proceedings affecting either party.</li>
          </ol>
        </div>
      </div>
      <div className="assistant-sources">
        <b>Sources</b>
        <span>
          Managed Services Agreement v3.2 <em>Section 12.1 · Material breach</em>
        </span>
        <span>
          Managed Services Agreement v3.2 <em>Section 12.2 · Convenience</em>
        </span>
        <span>
          Managed Services Agreement v3.2 <em>Section 12.3 · Insolvency</em>
        </span>
      </div>
      <div className="assistant-composer">
        Type a message… <Icon name="arrow" />
      </div>
      <small className="knowledge-status">Using approved knowledge</small>
    </div>
  );
}

function Solutions() {
  const products = [
    ['AI Assistant', 'Natural language for real work'],
    ['Enterprise RAG', 'Trusted knowledge, in context'],
    ['Document Intelligence', 'Understand and extract information'],
    ['Vision AI', 'Turn images into insights'],
    ['AI Workflows', 'Repeatable work, with control'],
  ];
  return (
    <>
      <section className="minimal-hero solutions-minimal">
        <div className="minimal-copy">
          <span className="minimal-kicker">AI SOLUTIONS</span>
          <h1>
            One AI workspace.
            <br />
            Five focused capabilities.
          </h1>
          <p>
            Ask questions. Retrieve trusted knowledge. Understand documents and images. Build repeatable
            AI workflows.
          </p>
        </div>
        <ProductPreview />
      </section>
      <section className="product-index">
        {products.map(([name, description]) => (
          <article key={name}>
            <h2>{name}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function Assistant() {
  return (
    <>
      <section className="minimal-hero assistant-minimal">
        <div className="minimal-copy">
          <span className="minimal-kicker">AI ASSISTANT</span>
          <h1>
            Answers grounded
            <br />
            in your business.
          </h1>
          <p>
            CloudCore AI retrieves from approved knowledge and returns concise answers with sources you
            can verify.
          </p>
        </div>
        <AssistantPreview />
      </section>
      <section className="assistant-statement">
        <h2>Ask naturally. Check the source. Continue the work.</h2>
        <div>
          <span>Cited responses</span>
          <span>Approved knowledge</span>
          <span>Document upload</span>
          <span>Chat history</span>
          <span>Multilingual</span>
        </div>
      </section>
    </>
  );
}

function Industries() {
  const sectors = [
    'Financial Services',
    'Public Sector',
    'Telecommunications',
    'Healthcare',
    'Education',
    'Manufacturing',
  ];
  return (
    <>
      <section className="minimal-hero industries-minimal">
        <div className="minimal-copy">
          <span className="minimal-kicker">AI BY INDUSTRY</span>
          <h1>
            The same AI foundation.
            <br />
            Shaped by different work.
          </h1>
          <p>
            Grounded conversation, document understanding and vision adapt to the information each sector
            relies on.
          </p>
        </div>
        <figure className="industry-photo">
          <img
            src="assets/industry-ai.png"
            alt="Telecommunications specialist reviewing operational information in Islamabad"
          />
        </figure>
      </section>
      <section className="industry-editorial">
        <nav aria-label="Industries">
          {sectors.map((sector) => (
            <span key={sector} className={sector === 'Telecommunications' ? 'selected' : undefined}>
              {sector}
            </span>
          ))}
        </nav>
        <div className="industry-focus">
          <h2>Telecommunications</h2>
          <p>
            Turn operational knowledge, field imagery and incident documents into faster, more consistent
            support.
          </p>
          <div className="industry-product">
            <div className="industry-answer">
              <span>How do I resolve a high VSWR alarm on a site?</span>
              <p>
                Inspect the feeder and connectors, verify antenna alignment, then compare the reading
                with the approved maintenance guide.
              </p>
              <small>RAN Maintenance Guide v3.2 · Site Troubleshooting Handbook</small>
            </div>
            <div className="industry-vision">
              <Icon name="image" />
              <b>Field image analysis</b>
              <span>Possible antenna misalignment</span>
              <small>Human verification required</small>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Resources() {
  const resources = [
    ['Evaluating grounded answers', 'Checklist · Enterprise RAG'],
    ['Designing document extraction with human review', 'Guide · Document Intelligence'],
    ['Planning a vision AI pilot', 'Guide · Vision AI'],
  ];
  const [query, setQuery] = useState('');
  const matches = (value: string) => value.toLowerCase().includes(query.trim().toLowerCase());
  return (
    <>
      <section className="resources-minimal">
        <span className="minimal-kicker">AI RESOURCES</span>
        <h1>
          Clear guidance for
          <br />
          building useful AI.
        </h1>
        <p>
          RAG, document intelligence, vision and responsible adoption—written for teams putting AI into
          real work.
        </p>
        <label className="resource-search">
          <Icon name="search" />
          <input
            id="resource-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the library"
            aria-label="Search the resource library"
          />
        </label>
      </section>
      <section className="resource-list" id="resource-list">
        <article className="resource-feature" hidden={!matches('enterprise rag knowledge base guide')}>
          <h2>Preparing your knowledge base for enterprise RAG</h2>
          <p>
            A practical guide to structuring, cleaning and governing content for high-quality, grounded
            answers.
          </p>
          <small>Guide · Enterprise RAG</small>
        </article>
        <div className="resource-rows">
          {resources.map(([title, type]) => (
            <article key={title} hidden={!matches(title + ' ' + type)}>
              <h3>{title}</h3>
              <small>{type}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="documentation-row">
        <h2>Product documentation</h2>
        <p>
          <a href="#assistant">AI Assistant</a>
          <span>/</span>
          <a href="#documents">Knowledge sources</a>
          <span>/</span>
          <a href="#documents">Document Insight</a>
          <span>/</span>
          <a href="#images">Image Analysis</a>
        </p>
      </section>
    </>
  );
}

function About() {
  return (
    <>
      <section className="minimal-hero about-minimal">
        <div className="minimal-copy">
          <span className="minimal-kicker">ABOUT CLOUDCORE AI</span>
          <h1>
            Business AI should be
            <br />
            useful, grounded and clear.
          </h1>
          <p>
            CloudCore AI brings conversational AI, enterprise RAG, document intelligence and vision into
            one coherent product experience.
          </p>
        </div>
        <ProductPreview />
      </section>
      <section className="about-principles-minimal">
        <h2>Built around the information your teams already use.</h2>
        <article>
          <h3>Ground every answer.</h3>
          <p>Use approved knowledge and show the source.</p>
        </article>
        <article>
          <h3>Keep people in control.</h3>
          <p>Preserve access, review and judgment.</p>
        </article>
        <article>
          <h3>Design for practical adoption.</h3>
          <p>Fit AI into real work without unnecessary complexity.</p>
        </article>
      </section>
      <section className="architecture-line">
        <span>Business knowledge</span>
        <i></i>
        <span>Enterprise RAG</span>
        <i></i>
        <span>
          AI Assistant&nbsp;&nbsp;/&nbsp;&nbsp;Document Insight&nbsp;&nbsp;/&nbsp;&nbsp;Image Analysis
        </span>
        <small>Access controls · Citations · Human review</small>
      </section>
    </>
  );
}
