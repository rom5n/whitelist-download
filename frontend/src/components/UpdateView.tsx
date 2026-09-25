import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CircleCheck, Download, ExternalLink, RotateCw, TriangleAlert } from 'lucide-react';
import { triggerUpdaterDownload, type UpdaterState } from '../api';
import { useTranslation } from '../i18n';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import Skeleton from '../ui/Skeleton';

export default function UpdateView({ updaterState }: { updaterState: UpdaterState | null }) {
  const { t } = useTranslation();
  const [requested, setRequested] = useState(false);
  const [lastStatus, setLastStatus] = useState(updaterState?.status);

  // The download was asked for: until the server reports otherwise, show it as started
  if (updaterState?.status !== lastStatus) {
    setLastStatus(updaterState?.status);
    if (updaterState && updaterState.status !== 'available' && updaterState.status !== 'downloading') {
      setRequested(false);
    }
  }

  if (!updaterState) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8" aria-busy="true">
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  const handleDownload = async () => {
    setRequested(true);
    await triggerUpdaterDownload();
  };

  const downloading = updaterState.status === 'downloading' || requested;
  const progress = updaterState.status === 'downloading' ? updaterState.progress : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
        <section className="rounded-lg border border-line bg-surface shadow-sm">
          <header className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-fg">{updaterState.title || 'Whitelist Download'}</h1>
              {updaterState.version && (
                <a
                  href={`https://github.com/rom5n/whitelist-download/releases/tag/v${updaterState.version}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 rounded-sm text-sm text-fg-2 hover:text-accent-text"
                >
                  v{updaterState.version}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end" aria-live="polite">
              {(updaterState.status === 'available' || updaterState.status === 'error') && !downloading && (
                <Button
                  variant={updaterState.status === 'error' ? 'danger' : 'primary'}
                  onClick={handleDownload}
                  icon={updaterState.status === 'error' ? <RotateCw className="size-4" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                >
                  {updaterState.status === 'error' ? t('update.error') : t('update.downloadInstall')}
                </Button>
              )}
              {updaterState.status === 'error' && updaterState.error && (
                <p className="flex max-w-xs items-start gap-1.5 text-sm text-danger-text">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {updaterState.error}
                </p>
              )}

              {downloading && (
                <div className="w-64 max-w-full">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-accent-text">
                      <Spinner />
                      {t('update.downloading')}
                    </span>
                    <span className="tabular-nums text-fg-2">{progress}%</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-raised"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('update.downloading')}
                  >
                    <div
                      className="h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-out"
                      style={{ transform: `scaleX(${progress / 100})` }}
                    />
                  </div>
                </div>
              )}

              {updaterState.status === 'installing' && (
                <Badge tone="accent" icon={<Spinner className="size-3.5" />}>{t('update.installing')}</Badge>
              )}
              {updaterState.status === 'reload' && (
                <Button variant="secondary" size="sm" onClick={() => window.location.reload()} icon={<RotateCw className="size-4" aria-hidden="true" />}>
                  {t('update.reload')}
                </Button>
              )}
              {updaterState.status === 'up-to-date' && (
                <Badge tone="success" icon={<CircleCheck className="size-3.5" aria-hidden="true" />}>{t('update.upToDate')}</Badge>
              )}
            </div>
          </header>

          <div className="prose prose-sm max-w-none border-t border-line p-5 text-fg-2 sm:p-6 dark:prose-invert
                          prose-headings:text-fg prose-headings:font-semibold prose-a:text-accent-text prose-strong:text-fg prose-code:text-fg">
            {updaterState.description ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{updaterState.description}</ReactMarkdown>
            ) : (
              <p>{t('update.noNotes')}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
