import { useTranslation, languageNames, Language } from '@/lib/i18n';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const LanguageSelector = ({ dropUp = false }: { dropUp?: boolean }) => {
  const { language, setLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const languages: Language[] = ['en', 'kn', 'hi'];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-teal-100/80 hover:text-white hover:bg-white/10 transition-colors"
        title="Change language"
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{languageNames[language]}</span>
      </button>

      {open && (
        <div className={`absolute right-0 ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'} bg-blue-900/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden min-w-[140px] z-50`}>
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setLanguage(lang);
                setOpen(false);
              }}
              className={`
                w-full text-left px-4 py-2.5 text-sm transition-colors
                ${language === lang
                  ? 'bg-teal-500/20 text-teal-300 font-medium'
                  : 'text-teal-100/70 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              {languageNames[lang]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
