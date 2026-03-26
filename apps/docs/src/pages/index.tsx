import type { ReactNode } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import DocGraph from '@site/src/components/DocGraph';

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Compute Intelligence Graph — interactive documentation graph"
    >
      <DocGraph />
    </Layout>
  );
}
