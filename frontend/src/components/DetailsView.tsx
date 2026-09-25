import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronLeft, Globe, TriangleAlert } from 'lucide-react';
import { parseVlessString, toCountryParam } from '../api';
import { useTranslation } from '../i18n';
import CopyButton from '../ui/CopyButton';
import Flag from '../ui/Flag';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { inputClass } from '../ui/styles';

interface DetailsViewProps {
  activeCountry: string | null;
  /** The selected config link, or null for the subscription (not the whole list, so loading more configs
      doesn't re-render this view) */
  activeConfig: string | null;
  baseSubLink: string;
  offset: number;
  limit: number;
  onOffsetChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;
  maxConfigs: number;
  /** Returns to the list on phones */
  onBack: () => void;
}

/**
 * The QR code in a "porthole": a white window (scanners need contrast in both themes) in a soft frame,
 * both with large rounded corners. The padding keeps the code's corners clear of the curve:
 * a corner radius r cuts about 0.3·r into the square, and the padding is wider than that.
 * With `flash`, the frame lights up once when it appears (a config was selected).
 */
function Porthole({ value, label, flash }: { value: string; label: string; flash: boolean }) {
  return (
    <div className="relative mx-auto h-fit rounded-porthole bg-raised p-1.5 shadow-[inset_0_0_0_1px_var(--line)] md:mx-0 md:self-start">
      {flash && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 animate-flash rounded-[calc(var(--radius-porthole)+4px)]
                     shadow-[0_0_0_2px_var(--accent),0_0_22px_2px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
        />
      )}
      <div className="rounded-[calc(var(--radius-porthole)-6px)] bg-white px-[18px] py-6 shadow-[inset_0_1px_3px_rgb(0_0_0/0.12)]">
        {value ? (
          <QRCodeSVG value={value} size={184} level="M" role="img" aria-label={label} className="block animate-fade" />
        ) : (
          <Skeleton className="size-[184px] rounded-md" />
        )}
      </div>
    </div>
  );
}

/** The QR code next to the link and its actions. */
const ShareCard = memo(function ShareCard({ value, label, qrLabel, flash = false, children }: { value: string; label: string; qrLabel: string; flash?: boolean; children?: ReactNode }) {
  return (
    <section className="grid gap-6 rounded-lg border border-line bg-surface p-5 shadow-sm sm:p-6 md:grid-cols-[auto_minmax(0,1fr)]">
      <Porthole value={value} label={qrLabel} flash={flash} />

      <div className="flex min-w-0 flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-fg-2">{label}</span>
          <input
            type="text"
            readOnly
            value={value}
            onFocus={event => event.currentTarget.select()}
            className={`${inputClass('default', true)} truncate`}
          />
        </label>
        <CopyButton text={value} className="w-full sm:w-auto sm:self-start" />
        {children}
      </div>
    </section>
  );
});

function RangeField({ label, value, valueLabel, min, max, onChange }: { label: string; value: number; valueLabel: string; min: number; max: number; onChange: (value: number) => void }) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-fg-2">{label}</span>
        <span className="font-medium tabular-nums text-fg">{valueLabel}</span>
      </span>
      <input
        type="range"
        min={min}
        max={Math.max(min + 1, max)}
        value={value}
        onChange={event => onChange(parseInt(event.target.value))}
        className="w-full"
        style={{ '--fill': `${fill}%` } as CSSProperties}
      />
    </label>
  );
}

export default memo(function DetailsView({
  activeCountry,
  activeConfig,
  baseSubLink,
  offset,
  limit,
  onOffsetChange,
  onLimitChange,
  maxConfigs,
  onBack,
}: DetailsViewProps) {
  const { t } = useTranslation();

  const parsedConfig = useMemo(() => (activeConfig ? parseVlessString(activeConfig) : null), [activeConfig]);

  const subUrl = useMemo(() => {
    if (!baseSubLink) return '';
    let url = baseSubLink;
    if (activeCountry) {
      url += `/${toCountryParam(activeCountry)}`;
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

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="press -ml-2 mb-4 flex h-11 items-center gap-1 rounded-md pl-1 pr-3 text-sm font-medium text-fg-2 hover:bg-raised hover:text-fg cursor-pointer md:hidden"
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
      {t('details.back')}
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl animate-enter px-4 py-6 sm:px-8 sm:py-10">
        {activeConfig === null ? (
          <>
            {backButton}
            <header className="mb-6 flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line bg-surface shadow-xs">
                {activeCountry ? <Flag country={activeCountry} className="size-7" /> : <Globe className="size-6 text-accent-text" aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <h1 className="text-3xl font-semibold tracking-tight text-fg">
                  {activeCountry ? `${activeCountry} · ${t('details.sub')}` : t('details.globalSub')}
                </h1>
                <p className="mt-1 text-sm text-fg-2">{t('details.scanOrCopy')}</p>
              </div>
            </header>

            <ShareCard value={subUrl} label={t('details.link')} qrLabel={t('details.qr')}>
              <div className="mt-2 border-t border-line pt-4">
                <p className="mb-1 text-sm font-medium text-fg">{t('details.paginationConfig')}</p>
                <RangeField
                  label={t('sub.offset')}
                  value={offset}
                  valueLabel={String(offset)}
                  min={1}
                  max={Math.max(1, maxConfigs)}
                  onChange={onOffsetChange}
                />
                <RangeField
                  label={t('details.limit')}
                  value={limit}
                  valueLabel={limit === 0 ? t('sub.noLimit') : String(limit)}
                  min={0}
                  max={Math.max(1, maxConfigs)}
                  onChange={onLimitChange}
                />
              </div>
            </ShareCard>
          </>
        ) : parsedConfig ? (
          <>
            {backButton}
            <header className="mb-6 flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line bg-surface shadow-xs">
                <Flag emoji={parsedConfig.flag} className="size-7" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-mono text-xl font-medium text-fg sm:text-3xl sm:leading-[2.125rem]">{parsedConfig.ip}</h1>
                <p className="mt-1 text-sm text-fg-2">
                  {parsedConfig.country || t('details.unknownLocation')} · {t('details.config')} {parsedConfig.sequence}
                </p>
              </div>
            </header>

            <ShareCard value={activeConfig} label={t('details.configLink')} qrLabel={t('details.qr')} flash />

            <section className="mt-6 rounded-lg border border-line bg-surface shadow-xs">
              <dl className="grid grid-cols-2 divide-line max-sm:divide-y sm:grid-cols-[1fr_1fr_2fr] sm:divide-x">
                <div className="p-4 sm:p-5">
                  <dt className="text-xs text-fg-3">{t('details.protocol')}</dt>
                  <dd className="mt-1 font-medium uppercase text-fg">{parsedConfig.protocol}</dd>
                </div>
                <div className="p-4 sm:p-5">
                  <dt className="text-xs text-fg-3">{t('details.port')}</dt>
                  <dd className="mt-1 font-medium tabular-nums text-fg">{parsedConfig.port}</dd>
                </div>
                <div className="col-span-2 p-4 sm:col-span-1 sm:p-5">
                  <dt className="text-xs text-fg-3">{t('details.uuid')}</dt>
                  <dd className="mt-1 font-mono text-[13px] break-all text-fg">{parsedConfig.uuid}</dd>
                </div>
              </dl>

              {parsedConfig.params.size > 0 && (
                <div className="border-t border-line p-4 sm:p-5">
                  <h2 className="mb-3 text-xs text-fg-3">{t('details.parameters')}</h2>
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
                    {Array.from(parsedConfig.params.entries()).map(([key, value]) => (
                      <div key={key} className="contents">
                        <dt className="text-sm text-fg-2">{key}</dt>
                        <dd className="font-mono text-[13px] break-all text-fg max-sm:mb-2">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            {backButton}
            <EmptyState tone="danger" icon={<TriangleAlert className="size-5" aria-hidden="true" />} title={t('details.parseError')} />
          </>
        )}
      </div>
    </div>
  );
});
