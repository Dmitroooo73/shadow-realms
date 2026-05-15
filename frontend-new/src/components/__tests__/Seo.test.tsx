import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Seo from '../Seo';

describe('Seo', () => {
  it('sets document title', () => {
    render(<Seo title="My Title" />);
    expect(document.title).toBe('My Title');
  });

  it('sets description meta and og:title', () => {
    render(<Seo title="T" description="D" />);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('D');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('T');
  });

  it('sets noindex when requested', () => {
    render(<Seo title="T" noIndex />);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow'
    );
  });

  it('writes canonical URL from origin + path', () => {
    render(<Seo title="T" canonicalPath="/foo" />);
    const href = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    expect(href).toMatch(/\/foo$/);
  });
});
