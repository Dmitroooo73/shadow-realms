import { useEffect } from 'react';

type SeoProps = {
  title: string;
  description?: string;
  canonicalPath?: string;
  noIndex?: boolean;
};

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

const Seo: React.FC<SeoProps> = ({ title, description, canonicalPath, noIndex }) => {
  useEffect(() => {
    document.title = title;

    if (description) {
      upsertMeta('meta[name="description"]', { name: 'description', content: description });
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    }

    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });

    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noIndex ? 'noindex, nofollow' : 'index, follow',
    });

    if (canonicalPath) {
      const origin = window.location.origin;
      upsertCanonical(`${origin}${canonicalPath}`);
      upsertMeta('meta[property="og:url"]', { property: 'og:url', content: `${origin}${canonicalPath}` });
    }
  }, [title, description, canonicalPath, noIndex]);

  return null;
};

export default Seo;
