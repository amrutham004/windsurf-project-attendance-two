/**
 * Footer.tsx - Reusable Footer Component
 * 
 * Displays copyright and CIT_24 branding across all pages
 */

import { useTranslation } from '@/lib/i18n';

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="relative z-10 py-6 border-t border-white/10 bg-blue-900/50 backdrop-blur-sm">
      <div className="container text-center">
        <p className="text-teal-100/60 text-sm">
          © {new Date().getFullYear()} CIT_24. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
