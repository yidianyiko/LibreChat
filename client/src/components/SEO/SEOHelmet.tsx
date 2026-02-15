import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOMetaProps {
  title?: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  keywords?: string;
}

/**
 * SEOHelmet - Reusable component for managing page-level SEO meta tags
 * 
 * @example
 * ```tsx
 * <SEOHelmet
 *   title="keep4forever - Free GPT-4o AI Chat"
 *   description="Get free access to GPT-4o..."
 *   canonicalUrl="https://keep4forever.com/register"
 * />
 * ```
 */
const SEOHelmet: React.FC<SEOMetaProps> = ({
  title,
  description,
  ogImage = 'https://keep4forever.com/assets/og-image.jpg',
  ogType = 'website',
  canonicalUrl = 'https://keep4forever.com',
  noIndex = false,
  keywords
}) => {
  const siteTitle = title ? `${title} | keep4forever` : 'keep4forever - Free GPT-4o AI Chat | Access Advanced AI Today';
  const siteDescription = description || 'Get free access to GPT-4o, the most advanced AI model. Chat, create, and explore with keep4forever - your reliable AI companion powered by OpenAI\'s latest technology.';
  const siteKeywords = keywords || 'GPT-4o, free GPT-4o, AI chat, ChatGPT alternative, OpenAI GPT-4o, AI assistant, free AI access';

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{siteTitle}</title>
      <meta name="description" content={siteDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="author" content="keep4forever" />
      
      {/* Robots Meta Tag */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={siteDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="keep4forever" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={siteDescription} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
};

export default SEOHelmet;
