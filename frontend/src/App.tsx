import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

interface Statistic {
  amount_configs: number;
  configs_by_country: Record<string, number>;
  last_update: number;
  up_at: number;
}

const countryFlags: Record<string, string> = {
  "United States": "🇺🇸", "Germany": "🇩🇪", "Russia": "🇷🇺", "Netherlands": "🇳🇱", "France": "🇫🇷",
  "United Kingdom": "🇬🇧", "Canada": "🇨🇦", "Singapore": "🇸🇬", "Finland": "🇫🇮", "Sweden": "🇸🇪",
  "Switzerland": "🇨🇭", "Poland": "🇵🇱", "Ukraine": "🇺🇦", "Japan": "🇯🇵", "Australia": "🇦🇺",
  "Austria": "🇦🇹", "Belgium": "🇧🇪", "Brazil": "🇧🇷", "Bulgaria": "🇧🇬", "Chile": "🇨🇱",
  "Colombia": "🇨🇴", "Croatia": "🇭🇷", "Cyprus": "🇨🇾", "Czechia": "🇨🇿", "Denmark": "🇩🇰",
  "Egypt": "🇪🇬", "Estonia": "🇪🇪", "Greece": "🇬🇷", "Hong Kong": "🇭🇰", "Hungary": "🇭🇺",
  "Iceland": "🇮🇸", "India": "🇮🇳", "Indonesia": "🇮🇩", "Ireland": "🇮🇪", "Israel": "🇮🇱",
  "Italy": "🇮🇹", "Latvia": "🇱🇻", "Lithuania": "🇱🇹", "Luxembourg": "🇱🇺", "Malaysia": "🇲🇾",
  "Mexico": "🇲🇽", "Moldova": "🇲🇩", "New Zealand": "🇳🇿", "Norway": "🇳🇴", "Philippines": "🇵🇭",
  "Portugal": "🇵🇹", "Romania": "🇷🇴", "Serbia": "🇷🇸", "Slovakia": "🇸🇰", "Slovenia": "🇸🇮",
  "South Africa": "🇿🇦", "South Korea": "🇰🇷", "Spain": "🇪🇸", "Taiwan": "🇹🇼", "Thailand": "🇹🇭",
  "Turkey": "🇹🇷", "United Arab Emirates": "🇦🇪", "Vietnam": "🇻🇳", "Argentina": "🇦🇷",
  "Belarus": "🇧🇾", "Bosnia & Herzegovina": "🇧🇦", "Cambodia": "🇰🇭", "China": "🇨🇳",
  "Costa Rica": "🇨🇷", "Cuba": "🇨🇺", "Dominican Republic": "🇩🇴", "Ecuador": "🇪🇨",
  "El Salvador": "🇸🇻", "Ethiopia": "🇪🇹", "Georgia": "🇬🇪", "Ghana": "🇬🇭", "Guatemala": "🇬🇹",
  "Honduras": "🇭🇳", "Iran": "🇮🇷", "Iraq": "🇮🇶", "Kazakhstan": "🇰🇿", "Kenya": "🇰🇪",
  "Kuwait": "🇰🇼", "Laos": "🇱🇦", "Lebanon": "🇱🇧", "Libya": "🇱🇾", "Macau": "🇲🇴",
  "Malta": "🇲🇹", "Mongolia": "🇲🇳", "Montenegro": "🇲🇪", "Morocco": "🇲🇦", "Myanmar": "🇲🇲",
  "Nepal": "🇳🇵", "Nicaragua": "🇳🇮", "Nigeria": "🇳🇬", "North Macedonia": "🇲🇰", "Oman": "🇴🇲",
  "Pakistan": "🇵🇰", "Panama": "🇵🇦", "Paraguay": "🇵🇾", "Peru": "🇵🇪", "Qatar": "🇶🇦",
  "Saudi Arabia": "🇸🇦", "Senegal": "🇸🇳", "Sri Lanka": "🇱🇰", "Syria": "🇸🇾", "Tanzania": "🇹🇿",
  "Tunisia": "🇹🇳", "Uganda": "🇺🇬", "Uruguay": "🇺🇾", "Uzbekistan": "🇺🇿", "Venezuela": "🇻🇪",
  "Yemen": "🇾🇪", "Zambia": "🇿🇲", "Zimbabwe": "🇿🇼", "Algeria": "🇩🇿", "Angola": "🇦🇴",
  "Azerbaijan": "🇦🇿", "Bahrain": "🇧🇭", "Bangladesh": "🇧🇩", "Bolivia": "🇧🇴", "Botswana": "🇧🇼",
  "Brunei": "🇧🇳", "Cameroon": "🇨🇲", "Congo (DRC)": "🇨🇩", "Congo (Republic)": "🇨🇬", "Ivory Coast": "🇨🇮",
  "Jordan": "🇯🇴", "Kyrgyzstan": "🇰🇬", "Madagascar": "🇲🇬", "Malawi": "🇲🇼", "Mali": "🇲🇱",
  "Mauritius": "🇲🇺", "Mozambique": "🇲🇿", "Namibia": "🇳🇦", "Niger": "🇳🇪",
  "North Korea": "🇰🇵", "Palestine": "🇵🇸", "Rwanda": "🇷🇼", "Somalia": "🇸🇴", "Sudan": "🇸🇩",
  "Tajikistan": "🇹🇯", "Togo": "🇹🇬", "Turkmenistan": "🇹🇲", "United States Minor Outlying Islands": "🇺🇲",
  "Western Sahara": "🇪🇭", "Unknown": "❓"
};

function getFlagEmoji(countryName: string): string {
  return countryFlags[countryName] || "🏳️"; // Default to white flag if not found
}

function App() {
  const [stats, setStats] = useState<Statistic | null>(null);
  const [baseSubLink, setBaseSubLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState('');

  // Custom builder state
  const [configCount, setConfigCount] = useState<number>(15);
  const [offsetCount, setOffsetCount] = useState<number>(0);

    useEffect(() => {
        fetch('/api/statistics')
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error('Failed to fetch stats:', err));

        fetch('/api/subscription-link')
            .then(res => res.text())
            .then(text => {
                try {
                    const url = new URL(text);
                    const parts = url.pathname.split('/');
                    const lastPart = parts[parts.length - 1];
                    if (/^\d+(-\d+)?$/.test(lastPart)) {
                        parts.pop();
                    }
                    url.pathname = parts.join('/');

                    let base = url.toString();
                    if (base.endsWith('/')) {
                        base = base.slice(0, -1);
                    }
                    setBaseSubLink(base);
                } catch(e) {
                    const parts = text.split('/');
                    const lastPart = parts[parts.length - 1];
                    if (/^\d+(-\d+)?$/.test(lastPart)) {
                        parts.pop();
                    }
                    setBaseSubLink(parts.join('/'));
                }
            })
            .catch(err => console.error('Failed to fetch sub link:', err));

        const interval = setInterval(() => {
            fetch('/api/statistics')
                .then(res => res.json())
                .then(data => setStats(data))
                .catch(err => console.error('Failed to fetch stats:', err));
        }, 5000);

        return () => clearInterval(interval);
    }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!stats?.last_update) {
      setCountdown('');
      return;
    }

    const updateInterval = 60 * 60 * 1000; // 1 hour in milliseconds
    let timer: number; // Use number type for setInterval in browser

    const calculateCountdown = () => {
      const lastUpdateMs = stats.last_update * 1000;
      const nextUpdateMs = lastUpdateMs + updateInterval;
      const nowMs = Date.now();
      const timeLeftMs = nextUpdateMs - nowMs;

      if (timeLeftMs <= 0) {
        setCountdown('Обновление...');
        // Optionally trigger a stats fetch immediately if update is due
        fetch('/statistic')
          .then(res => res.json())
          .then(data => setStats(data))
          .catch(err => console.error('Failed to fetch stats:', err));
        return;
      }

      const minutes = Math.floor((timeLeftMs / (1000 * 60)) % 60);
      const seconds = Math.floor((timeLeftMs / 1000) % 60);

      setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    calculateCountdown(); // Initial calculation
    timer = window.setInterval(calculateCountdown, 1000); // Update every second

    return () => clearInterval(timer);
  }, [stats?.last_update]); // Re-run effect when last_update changes

  const finalSubLink = useMemo(() => {
    if (!baseSubLink) return '';
    if (offsetCount > 0) {
       return `${baseSubLink}/${offsetCount}-${configCount}`;
    }
    return `${baseSubLink}/${configCount}`;
  }, [baseSubLink, offsetCount, configCount]);

  const handleCopy = async () => {
    if (!finalSubLink) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(finalSubLink);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = finalSubLink;
        // Position off-screen to prevent scrolling
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const formatUptime = (upAt: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - upAt;
    
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (days > 0) return `${days}д ${hours}ч`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };

  const formatLastUpdate = (lastUpdate: number) => {
    if (!lastUpdate) return 'Никогда';
    const date = new Date(lastUpdate * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app-container">
      <div className="background-animation"></div> {/* Background animation container */}
      <header>
        <h1>Whitelist Download</h1>
        <p className="subtitle">Open-source конфиги для обхода белых списков</p>
        <a href="https://github.com/rom5n/whitelist-download" target="_blank" rel="noreferrer" className="github-button">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
          </svg>
          GitHub
        </a>
      </header>

      <div className="grid">
        <div className="card">
          <h2>Подключение</h2>
          
          {baseSubLink ? (
            <>
              <div className="builder-container">
                 <div className="builder-group">
                   <label>Количество конфигов:</label>
                   <input 
                     type="number" 
                     min="1" 
                     value={configCount} 
                     onChange={(e) => setConfigCount(Number(e.target.value) || 1)}
                     className="builder-input"
                   />
                 </div>
                 <div className="builder-group">
                   <label>Начиная с какого по счету:</label>
                   <input 
                     type="number" 
                     min="0" 
                     value={offsetCount} 
                     onChange={(e) => setOffsetCount(Number(e.target.value) || 0)}
                     className="builder-input"
                   />
                 </div>
              </div>

              <div className="qr-container">
                <QRCodeSVG value={finalSubLink} size={200} level="M" includeMargin={false} />
              </div>
              
              <button 
                className={`link-button ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
              >
                {copied ? 'Скопировано!' : 'Копировать ссылку'}
              </button>
            </>
          ) : (
            <div className="loading">Загрузка данных...</div>
          )}
        </div>

        <div className="card">
          <h2>Статистика сети</h2>
          
          {stats ? (
            <>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value">{stats.amount_configs}</div>
                  <div className="stat-label">Активные конфиги</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{formatUptime(stats.up_at)}</div>
                  <div className="stat-label">Аптайм</div>
                </div>
                <div className="stat-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="stat-value" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
                    {formatLastUpdate(stats.last_update)}
                    {countdown && <span className="countdown-timer">({countdown})</span>}
                  </div>
                  <div className="stat-label">Последнее обновление</div>
                </div>
              </div>

              {stats.configs_by_country && Object.keys(stats.configs_by_country).length > 0 && (
                <div className="countries-list">
                  <div className="countries-title">Конфиги по регионам</div>
                  <div className="countries-scroll">
                    {Object.entries(stats.configs_by_country)
                      .sort(([, a], [, b]) => b - a)
                      .map(([country, count]) => (
                        <div key={country} className="country-item">
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span className="flag">{getFlagEmoji(country)}</span>
                            <span>{country}</span>
                          </div>
                          <span style={{ color: 'var(--text-muted)' }}>{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="loading">Загрузка статистики...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;