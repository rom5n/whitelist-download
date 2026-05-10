import { useState } from 'react';
import Header from './components/Header';
import SubscriptionCard from './components/SubscriptionCard';
import StatisticsCard from './components/StatisticsCard';
import ControlPanel from './components/ControlPanel';
import SettingsModal from './components/SettingsModal';
import LogsModal from './components/LogsModal';

/**
 * Root layout component for the Whitelist Download dashboard.
 * Renders the star background, header, and a responsive two-column grid
 * containing subscription, statistics, and control cards.
 */
export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="min-h-screen text-[var(--color-text-primary)]">
      {/* Animated star background */}
      <div className="stars-layer">
        <div className="stars-sm" />
        <div className="stars-sm" />
        <div className="stars-md" />
        <div className="stars-md" />
        <div className="stars-lg" />
      </div>

      {/* Main content */}
      <div className="max-w-[900px] mx-auto px-4 py-12 relative z-10">
        <Header />

        {/* Responsive dashboard grid: left = subscription, right = stats + controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left column */}
          <div>
            <SubscriptionCard />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            <StatisticsCard />
            <ControlPanel
              onOpenSettings={() => setShowSettings(true)}
              onOpenLogs={() => setShowLogs(true)}
            />
          </div>
        </div>
      </div>

      {/* Modal overlays */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <LogsModal open={showLogs} onClose={() => setShowLogs(false)} />
    </div>
  );
}