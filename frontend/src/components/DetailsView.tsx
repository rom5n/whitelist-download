import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { parseVlessString } from '../api';
import { useTranslation } from '../i18n';

interface DetailsViewProps {
  activeCountry: string | null;
  activeConfigIndex: number | null;
  configs: string[];
  baseSubLink: string;
  offset: number;
  limit: number;
  onOffsetChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;
  maxConfigs: number;
}

export default function DetailsView({
  activeCountry,
  activeConfigIndex,
  configs,
  baseSubLink,
  offset,
  limit,
  onOffsetChange,
  onLimitChange,
  maxConfigs,
}: DetailsViewProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const activeConfigStr = activeConfigIndex !== null ? configs[activeConfigIndex] : null;
  const parsedConfig = useMemo(() => {
    return activeConfigStr ? parseVlessString(activeConfigStr) : null;
  }, [activeConfigStr]);

  const subUrl = useMemo(() => {
    if (!baseSubLink) return '';
    let url = baseSubLink;
    if (activeCountry) {
      url += `/${activeCountry.toLowerCase().replace(/\s+/g, '-')}`;
    }
    
    if (offset > 1 && limit > 0) {
      url += `/${offset}-${limit}`;
    } else if (offset > 1 && limit === 0) {
      url += `/${offset}-${maxConfigs}`;
    } else if (limit > 0 && limit !== 15) {
      url += `/${limit}`;
    } else if (limit === 15 && offset === 1) {
      url += `/15`;
    }
    
    return url;
  }, [baseSubLink, activeCountry, offset, limit, maxConfigs]);

  const handleCopy = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or non-HTTPS localhost
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--color-bg-primary)] p-6 md:p-10 overflow-y-auto relative">
      <div className="max-w-2xl mx-auto w-full space-y-8 animate-[fade-in_0.3s_ease-out]">
        
        {activeConfigIndex === null ? (
          <>
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                {activeCountry ? `${activeCountry} ${t('details.sub')}` : t('details.globalSub')}
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                {t('details.scanOrCopy')}
              </p>
            </div>

            <div className="glass-card p-8 rounded-2xl flex flex-col items-center justify-center space-y-6 shadow-xl">
              <div className="bg-white p-4 rounded-xl shadow-inner">
                {subUrl ? (
                  <QRCodeSVG value={subUrl} size={200} level="M" />
                ) : (
                  <div className="w-[200px] h-[200px] bg-gray-200 animate-pulse rounded-md" />
                )}
              </div>
              
              <div className="w-full flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={subUrl}
                  className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] px-4 py-3 rounded-xl outline-none font-mono text-sm"
                />
                <button
                  onClick={() => handleCopy(subUrl)}
                  className="bg-accent hover:bg-accent-hover cursor-pointer text-white px-6 py-3 rounded-xl font-medium transition-colors whitespace-nowrap shadow-md"
                >
                  {copied ? t('sub.copied') : t('sub.copyLink')}
                </button>
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl space-y-6 border border-[var(--color-border)]">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">{t('details.paginationConfig')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    {t('sub.offset')}: {offset}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max={Math.max(1, maxConfigs)}
                    value={offset}
                    onChange={(e) => onOffsetChange(parseInt(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    {t('details.limit')}: {limit === 0 ? t('sub.noLimit') : limit}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(1, maxConfigs)}
                    value={limit}
                    onChange={(e) => onLimitChange(parseInt(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  {t('details.adjustSliders')}
                </p>
              </div>
            </div>
          </>
        ) : parsedConfig ? (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-4xl drop-shadow-md">{parsedConfig.flag || '🏳️'}</div>
              <div>
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                  {parsedConfig.ip}
                </h1>
                <p className="text-[var(--color-text-secondary)]">
                  {parsedConfig.country || t('details.unknownLocation')} • {t('details.config')} {parsedConfig.sequence}
                </p>
              </div>
            </div>

            <div className="glass-card p-8 rounded-2xl flex flex-col items-center justify-center space-y-6 shadow-xl border border-[var(--color-border)]">
              <div className="bg-white p-4 rounded-xl shadow-inner">
                <QRCodeSVG value={activeConfigStr!} size={200} level="M" />
              </div>
              
              <div className="w-full flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={activeConfigStr!}
                  className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-primary)] px-4 py-3 rounded-xl outline-none font-mono text-sm"
                />
                <button
                  onClick={() => handleCopy(activeConfigStr!)}
                  className="bg-accent hover:bg-accent-hover cursor-pointer text-white px-6 py-3 rounded-xl font-medium transition-colors whitespace-nowrap shadow-md"
                >
                  {copied ? t('sub.copied') : t('sub.copyLink')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-5 rounded-xl border border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)] uppercase font-semibold mb-1">{t('details.protocol')}</p>
                <p className="text-[var(--color-text-primary)] font-medium text-lg uppercase">{parsedConfig.protocol}</p>
              </div>
              <div className="glass-card p-5 rounded-xl border border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)] uppercase font-semibold mb-1">{t('details.port')}</p>
                <p className="text-[var(--color-text-primary)] font-medium text-lg">{parsedConfig.port}</p>
              </div>
              <div className="glass-card p-5 rounded-xl col-span-2 border border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)] uppercase font-semibold mb-1">{t('details.uuid')}</p>
                <p className="text-[var(--color-text-primary)] font-mono text-sm break-all">{parsedConfig.uuid}</p>
              </div>
            </div>
            
            <div className="glass-card p-5 rounded-xl border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)] uppercase font-semibold mb-3">{t('details.parameters')}</p>
              <div className="flex flex-wrap gap-2">
                {Array.from(parsedConfig.params.entries()).map(([key, value]) => (
                  <div key={key} className="bg-[var(--color-bg-input)] border border-[var(--color-border)] px-3 py-1.5 rounded-md text-sm shadow-inner overflow-hidden" style={{ wordBreak: 'break-word' }}>
                    <span className="text-[var(--color-text-secondary)] font-medium">{key}:</span>{' '}
                    <span className="text-[var(--color-text-primary)] font-mono text-xs">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center p-10 text-[var(--color-text-muted)]">
            {t('details.parseError')}
          </div>
        )}
      </div>
    </div>
  );
}
