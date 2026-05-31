import React from 'react';
import { Link } from 'react-router-dom';
import { LogoHero } from '../components/ui/Logo';
import termsMd from '../content/terms.md?raw';
import privacyMd from '../content/privacy.md?raw';

// Public legal pages (Terms of Service, Privacy Policy). These are reachable
// without a session — they're rendered outside the auth Gate so external
// reviewers (e.g. Google OAuth verification) can load /terms and /privacy.
//
// Content is authored as Markdown in src/content/{terms,privacy}.md so it stays
// a single source of truth and is editable without touching this code. Vite
// bundles it inline via the ?raw import (so there's no separate public .md URL),
// and we render it with the small Markdown renderer below — the content only
// uses headings, paragraphs, bullet lists, bold, and links, so a focused
// renderer is enough and avoids a markdown dependency.

const DOCS = {
  terms: { title: 'Terms of Service', markdown: termsMd },
  privacy: { title: 'Privacy Policy', markdown: privacyMd }
} as const;

// Renders inline Markdown: **bold** and [text](url) links. Returns React nodes.
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Matches **bold** or [label](href); whichever comes first is consumed.
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={key++}>{match[1]}</strong>);
    } else {
      const href = match[3];
      const isExternal = /^https?:\/\//.test(href);
      nodes.push(
        <a
          key={key++}
          href={href}
          className="text-primary hover:underline"
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {match[2]}
        </a>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

// Parses a small subset of Markdown (# / ## headings, * bullet lists, blank-line
// separated paragraphs) into React elements. Inline bold/links are handled by
// renderInline.
function renderMarkdown(md: string): React.ReactNode {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(
        <h2
          key={key++}
          className="text-lg font-heading font-bold text-text-primary mt-8 mb-2">
          {renderInline(line.slice(3))}
        </h2>);
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push(
        <h1
          key={key++}
          className="text-2xl font-heading font-bold text-text-primary mb-4">
          {renderInline(line.slice(2))}
        </h1>);
      i++;
      continue;
    }

    if (line.trimStart().startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('* ')) {
        items.push(lines[i].trimStart().slice(2));
        i++;
      }
      blocks.push(
        <ul
          key={key++}
          className="list-disc pl-5 space-y-1 text-text-secondary mb-2">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>);
      continue;
    }

    // Otherwise a paragraph: gather consecutive non-blank, non-structural lines.
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].trimStart().startsWith('* ')) {
      paragraph.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} className="text-text-secondary leading-relaxed mb-2">
        {renderInline(paragraph.join(' '))}
      </p>);
  }

  return blocks;
}

export function LegalPage({ doc }: { doc: 'terms' | 'privacy' }) {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center mb-8">
          <Link to="/" aria-label="Whiskerville home">
            <LogoHero className="w-40" />
          </Link>
        </div>

        <div className="bg-card rounded-2xl shadow-soft-lg border border-border p-8 sm:p-10">
          {renderMarkdown(DOCS[doc].markdown)}
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            ← Back to Whiskerville
          </Link>
        </div>
      </div>
    </div>);

}
