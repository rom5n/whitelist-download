import { useState, useEffect } from 'react';
import { triggerUpdaterDownload, type UpdaterState } from '../api';
import { useTranslation } from '../i18n';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function UpdateView({ updaterState }: { updaterState: UpdaterState | null }) {
  const [downloading, setDownloading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (updaterState && updaterState.status !== 'available' && updaterState.status !== 'downloading') {
      setDownloading(false);
    }
  }, [updaterState]);

  if (!updaterState) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="text-[var(--color-text-muted)] animate-pulse">{t('settings.loading')}</div>
      </div>
    );
  }

  const handleDownload = async () => {
    setDownloading(true);
    await triggerUpdaterDownload();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-bg-primary)] p-6 md:p-10 relative flex justify-center">
      <div className="w-full max-w-3xl space-y-8 animate-[fade-in_0.3s_ease-out]">
        
        <div className="bg-[var(--color-bg-input)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h3 className="text-xl font-semibold text-accent">
              {updaterState.version ? (
                <a
                  href={`https://github.com/rom5n/whitelist-download/releases/tag/v${updaterState.version}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center"
                  title="Open release in GitHub"
                >
                  {updaterState.title || 'Whitelist Download'}
                  <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-3">v{updaterState.version}</span>
                </a>
              ) : (
                <>
                  {updaterState.title || 'Whitelist Download'}
                </>
              )}
            </h3>
            
            {(updaterState.status === 'available' || updaterState.status === 'error') && !downloading && (
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <button 
                  onClick={handleDownload}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors shadow-md w-max cursor-pointer border-none ${
                    updaterState.status === 'error' ? 'bg-danger hover:bg-danger/80' : 'bg-accent hover:bg-accent-hover'
                  }`}
                >
                  {updaterState.status === 'error' ? t('update.error') : t('update.downloadInstall')}
                </button>
                {updaterState.status === 'error' && (
                  <span className="text-sm font-medium text-danger bg-danger/10 px-3 py-1.5 rounded-lg border border-danger/20 max-w-xs break-words">
                    {updaterState.error}
                  </span>
                )}
              </div>
            )}
            
            {(updaterState.status === 'downloading' || downloading) && (
              <div className="flex flex-col gap-2 w-full max-w-sm">
                <span className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-2 w-max">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" /><path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" /></svg>
                  {t('update.downloading')} {updaterState.status === 'downloading' ? updaterState.progress : 0}%
                </span>
                <div className="h-2 w-full bg-blue-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${updaterState.status === 'downloading' ? updaterState.progress : 0}%` }} />
                </div>
              </div>
            )}
            
            {updaterState.status === 'installing' && (
              <span className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-2 w-max">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" /><path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" /></svg>
                {t('update.installing')}
              </span>
            )}
            
            {updaterState.status === 'reload' && (
              <span className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/20 text-amber-500 border border-amber-500/30 w-max">
                {t('update.reload')}
              </span>
            )}
            
            {updaterState.status === 'up-to-date' && (
              <span className="px-4 py-2 rounded-xl text-sm font-medium bg-success/20 text-success border border-success/30 w-max">
                {t('update.upToDate')}
              </span>
            )}
          </div>
          
          <div className="prose dark:prose-invert max-w-none text-sm text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-6">
            {updaterState.description ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{updaterState.description}</ReactMarkdown>
            ) : (
              <p>{t('update.noNotes')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
