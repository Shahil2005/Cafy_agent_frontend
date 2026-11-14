import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { FileText } from 'lucide-react';
import {
  PRIVACY_POLICY_EFFECTIVE_FROM,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_TABLE_OF_CONTENTS,
  privacyPolicyBodyContent,
} from '../constants/privacyPolicyContent';

const getTextFromNode = (node: React.ReactNode): string => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextFromNode).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getTextFromNode(node.props.children);
  }
  return '';
};

const generateId = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/(^-|-$)/g, '');

const PrivacyPolicy: React.FC = () => {
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      const headings = Array.from(document.querySelectorAll('h2[id]'));
      if (headings.length === 0) return;

      let currentActiveId = headings[0].id;
      const offset = 120;

      for (const heading of headings) {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= offset) {
          currentActiveId = heading.id;
        } else {
          break;
        }
      }

      const isAtBottom =
        window.innerHeight + Math.round(window.scrollY) >= document.body.offsetHeight - 50;
      if (isAtBottom) {
        currentActiveId = headings[headings.length - 1].id;
      }

      setActiveSection(currentActiveId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
      window.history.pushState(null, '', `#${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 font-inter">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-start gap-10 lg:gap-14">
        <aside className="hidden lg:block w-72 shrink-0 sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto pr-4">
          <div className="mb-6 flex items-center gap-2 text-[#0a77dc] font-semibold text-sm tracking-wide uppercase">
            <FileText className="w-4 h-4" />
            <span>Privacy Policy</span>
          </div>
          <nav className="flex flex-col relative before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200">
            {PRIVACY_POLICY_TABLE_OF_CONTENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={`py-2 pl-5 text-sm text-left transition-all duration-200 relative border-l border-transparent ${
                  activeSection === item.id
                    ? 'text-[#0a77dc] font-medium border-[#0a77dc]'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 w-full max-w-4xl bg-white rounded-2xl shadow-sm p-8 md:p-12 lg:p-16 border border-gray-200">
          <div className="mb-8">
            <Link
              to="/"
              className="text-[#0a77dc] hover:text-[#084b90] text-sm font-medium hover:underline"
            >
              &larr; Back to Home
            </Link>
          </div>

          <header className="mb-12 border-b border-slate-100 pb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-6">
              Privacy Policy
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 text-slate-500 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">Last updated:</span>
                {PRIVACY_POLICY_LAST_UPDATED}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">Effective from:</span>
                {PRIVACY_POLICY_EFFECTIVE_FROM}
              </div>
            </div>
          </header>

          <section className="mb-10 lg:hidden">
            <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">
              Table of Contents
            </h5>
            <ol className="space-y-2">
              {PRIVACY_POLICY_TABLE_OF_CONTENTS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="text-[#0a77dc] hover:text-[#084b90] hover:underline font-semibold text-sm text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <div className="text-slate-600 leading-relaxed max-w-none">
            <ReactMarkdown
              components={{
                h2: ({ children, ...props }) => {
                  const text = getTextFromNode(children);
                  const id = generateId(text);
                  return (
                    <h2
                      id={id}
                      className="text-2xl mt-16 mb-6 font-semibold text-slate-900 tracking-tight scroll-mt-24 pb-4 border-b border-slate-100 first:mt-0"
                      {...props}
                    >
                      {children}
                    </h2>
                  );
                },
                h3: ({ children, ...props }) => {
                  const text = getTextFromNode(children);
                  const id = generateId(text);
                  return (
                    <h3
                      id={id}
                      className="text-lg mt-10 mb-4 font-semibold text-slate-800 scroll-mt-24"
                      {...props}
                    >
                      {children}
                    </h3>
                  );
                },
                p: ({ children, ...props }) => (
                  <p className="mb-5 text-[1.05rem]" {...props}>
                    {children}
                  </p>
                ),
                ul: ({ children, ...props }) => (
                  <ul className="mb-8 mt-2 space-y-2 list-disc pl-6" {...props}>
                    {children}
                  </ul>
                ),
                li: ({ children, ...props }) => (
                  <li className="pl-1 marker:text-slate-400" {...props}>
                    {children}
                  </li>
                ),
                a: ({ children, ...props }) => (
                  <a className="text-[#0a77dc] hover:text-[#084b90] hover:underline" {...props}>
                    {children}
                  </a>
                ),
                strong: ({ children, ...props }) => (
                  <strong className="font-semibold text-slate-900" {...props}>
                    {children}
                  </strong>
                ),
              }}
            >
              {privacyPolicyBodyContent}
            </ReactMarkdown>
          </div>

          <footer className="pt-8 mt-12 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} CAREERSFORYOU LIMITED. All rights reserved.</p>
          </footer>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 bg-[#0a77dc] hover:bg-[#084b90] text-white p-3 rounded-full shadow-lg transition-colors z-50"
        aria-label="Back to top"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
};

export default PrivacyPolicy;
