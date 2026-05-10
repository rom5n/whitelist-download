import { useState, useEffect, useMemo, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from '../i18n';
import { fetchSubscriptionLink, parseBaseSubLink } from '../api';

/**
 * Subscription card with QR code, link builder (config count + offset),
 * and copy-to-clipboard functionality.
 */
export default function SubscriptionCard() {
  const { t } = useTranslation();
  const [baseSubLink, setBaseSubLink] = useState('');
  const [configCount, setConfigCount] = useState(15);
  const [offsetCount, setOffsetCount] = useState(0);
  const [copied, setCopied] = useState(false);

  /** Fetch base subscription link on mount */
  useEffect(() => {
    fetchSubscriptionLink()
      .then(text => setBaseSubLink(parseBaseSubLink(text)))
      .catch(err => console.error('Failed to fetch subscription link:', err));
  }, []);

  /** Build the final subscription URL from base + offset/limit */
  const finalSubLink = useMemo(() => {
    if (!baseSubLink) return '';
    return offsetCount > 0
      ? `${baseSubLink}/${offsetCount}-${configCount}`
      : `${baseSubLink}/${configCount}`;
  }, [baseSubLink, offsetCount, configCount]);

  /**
   * Copies the subscription link to clipboard.
   * Falls back to textarea method for older browsers.
   */
  const handleCopy = useCallback(async () => {
    if (!finalSubLink) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(finalSubLink);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = finalSubLink;
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, [finalSubLink]);

  return (
    <div className="glass-card rounded-2xl p-6 animate-slide-up">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-5">
        {t('sub.title')}
      </h2>

      {baseSubLink ? (
        <>
          {/* Config count & offset inputs */}
          <div className="flex flex-col gap-4 mb-5">
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">
                {t('sub.configCount')}
              </label>
              <input
                id="config-count-input"
                type="number"
                min="1"
                value={configCount}
                onChange={e => setConfigCount(Number(e.target.value) || 1)}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-medium
                           bg-[var(--color-bg-input)] border border-[var(--color-border)]
                           text-[var(--color-text-primary)] outline-none
                           transition-colors duration-200 focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">
                {t('sub.offset')}
              </label>
              <input
                id="offset-count-input"
                type="number"
                min="0"
                value={offsetCount}
                onChange={e => setOffsetCount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-medium
                           bg-[var(--color-bg-input)] border border-[var(--color-border)]
                           text-[var(--color-text-primary)] outline-none
                           transition-colors duration-200 focus:border-accent"
              />
            </div>
          </div>

          {/* QR code */}
          <div className="bg-white p-4 rounded-xl mx-auto mb-5 w-fit">
            <QRCodeSVG value={finalSubLink} size={200} level="M" includeMargin={false} />
          </div>

          {/* Subscription link display */}
          <div className="mb-4 px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)]
                          text-xs text-[var(--color-text-secondary)] break-all font-mono select-all">
            {finalSubLink}
          </div>

          {/* Copy button */}
          <button
            id="copy-link-btn"
            onClick={handleCopy}
            className={`w-full py-3 rounded-xl text-sm font-semibold cursor-pointer
                        border-none transition-all duration-200
                        ${copied
                          ? 'bg-success text-white'
                          : 'bg-accent text-white hover:bg-accent-hover hover:-translate-y-0.5'
                        }`}
          >
            {copied ? t('sub.copied') : t('sub.copyLink')}
          </button>
        </>
      ) : (
        <div className="text-center py-8 text-[var(--color-text-muted)] text-sm animate-pulse-glow">
          {t('sub.loading')}
        </div>
      )}
    </div>
  );
}
