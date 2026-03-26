import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import OrbitalTimeline from '@site/src/components/OrbitalTimeline';

import styles from './index.module.css';

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Compute Intelligence Graph — interactive documentation"
    >
      {/* Full-screen orbital hero */}
      <OrbitalTimeline />

      {/* Below-fold quick links */}
      <section className={styles.quickLinks}>
        <div className="container">
          <div className={styles.quickLinksGrid}>
            <Link className={styles.quickCard} to="/docs/en/getting-started">
              🚀 <span>Getting Started</span>
            </Link>
            <Link className={styles.quickCard} to="/docs/en/architecture">
              🏗️ <span>Architecture</span>
            </Link>
            <Link className={styles.quickCard} to="/docs/en/api-reference">
              ⚡ <span>API Reference</span>
            </Link>
            <Link className={styles.quickCard} to="/docs/en/developer-guide">
              🛠️ <span>Developer Guide</span>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
