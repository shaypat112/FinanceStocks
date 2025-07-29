import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface StockData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  prevClose: number | null;
}


export default function Home() {
  const [symbol, setSymbol] = useState('');
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // History: start empty, then load from localStorage on client
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    try {
      const item = localStorage.getItem('stockSearchHistory');
      if (item) {
        setHistory(JSON.parse(item));
      }
    } catch {
      setHistory([]);
    }
  }, []);

  // Favorites: same pattern, lazy init in useEffect
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('stockFavorites');
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch {
      setFavorites([]);
    }
  }, []);

  const [multiDayData, setMultiDayData] = useState([]);
  const [marketStatus, setMarketStatus] = useState('Loading...');
  const [time, setTime] = useState(new Date());

  const inputRef = useRef<HTMLInputElement>(null);

  // Market open/close checker (EST time 9:30-16:00)
  useEffect(() => {
    function checkMarketStatus() {
      const now = new Date();
      setTime(now);
      const estNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const hour = estNow.getHours();
      const minutes = estNow.getMinutes();
      const day = estNow.getDay(); // Sunday=0, Saturday=6

      const open = (hour > 9 || (hour === 9 && minutes >= 30));
      const close = (hour < 16);

      if (day === 0 || day === 6) setMarketStatus('Market Closed (Weekend)');
      else if (open && close) setMarketStatus('Market Open');
      else setMarketStatus('Market Closed');
    }
    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Save history and favorites to localStorage when they change
  useEffect(() => {
    localStorage.setItem('stockSearchHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('stockFavorites', JSON.stringify(favorites));
  }, [favorites]);

  // Toggle favorite
  function toggleFavorite(sym: string) {
    if (favorites.includes(sym)) {
      setFavorites(favorites.filter(f => f !== sym));
    } else {
      setFavorites([...favorites, sym]);
    }
  }

  // Add to history, max 10 items
  function addToHistory(sym: string) {
    setHistory(prev => {
      const newHist = [sym, ...prev.filter(h => h !== sym)].slice(0, 10);
      return newHist;
    });
  }

  // Format price change + percent with arrows
  function renderChange(close: number, prevClose: number | null) {
    if (prevClose === null) return null;
    const change = close - prevClose;
    const percent = (change / prevClose) * 100;
    const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '';
    const color = change > 0 ? '#16a34a' : change < 0 ? '#dc2626' : '#6b7280';

    return (
      <span style={{ color, fontWeight: '700' }}>
        {arrow} {change.toFixed(2)} ({percent.toFixed(2)}%)
      </span>
    );
  }

  // Fetch stock data with multi-day summary
  async function fetchStock() {
    setError('');
    setStockData(null);
    setMultiDayData([]);
    if (!symbol) {
      setError('Please enter a stock symbol');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`/api/stock?symbol=${symbol}`);
      const data = await res.json();

      if (res.ok) {
        const timeSeries = data['Time Series (Daily)'];
        if (!timeSeries) {
          setError('No time series data available for this symbol');
          setLoading(false);
          return;
        }

        const dates = Object.keys(timeSeries).sort().reverse();
        const latestDate = dates[0];
        const latestData = timeSeries[latestDate];

        // Prepare multi-day array for chart & summary table (limit 10 days)
        const multiDays = dates.slice(0, 10).map(date => {
          const d = timeSeries[date];
          return {
            date,
            open: +d['1. open'],
            high: +d['2. high'],
            low: +d['3. low'],
            close: +d['4. close'],
            volume: +d['5. volume'],
          };
        });

        setStockData({
          date: latestDate,
          open: +latestData['1. open'],
          high: +latestData['2. high'],
          low: +latestData['3. low'],
          close: +latestData['4. close'],
          volume: +latestData['5. volume'],
          prevClose: dates.length > 1 ? +timeSeries[dates[1]]['4. close'] : null,
        });
        setMultiDayData(multiDays);

        addToHistory(symbol);
      } else {
        setError(data['Error Message'] || 'Failed to fetch stock data');
      }
    } catch {
      setError('Error fetching stock data');
    }
    setLoading(false);
  }

  // Share current stock link
  function shareLink() {
    const url = `${window.location.origin}?symbol=${symbol}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  }

  // On mount, check URL param for symbol
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sym = urlParams.get('symbol');
    if (sym) {
      setSymbol(sym.toUpperCase());
      setTimeout(fetchStock, 300);
    }
  }, []);

  // Export CSV scaffold
  function exportCSV() {
    if (!multiDayData.length) return;
    const header = 'Date,Open,High,Low,Close,Volume\n';
    const rows = multiDayData
      .map(
        (d) => `${d.date},${d.open},${d.high},${d.low},${d.close},${d.volume}`
      )
      .join('\n');
    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Placeholder news feed
  const news = [
    { title: 'Market rallies on positive earnings', url: '#' },
    { title: 'Tech stocks lead the way', url: '#' },
    { title: 'Analysts predict strong Q3 for ' + symbol, url: '#' },
  ];

  return (
    <>
      <div>
        <div className="background" />
        <main style={styles.main}>
          <header style={styles.header}>
            <h1 style={styles.title}>Stock Predictor</h1>
          </header>

          <p style={styles.marketStatus}>
            {marketStatus} — {time.toLocaleTimeString()}
          </p>

          <div style={styles.inputGroup}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Symbol (e.g. AAPL)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              style={styles.input}
              disabled={loading}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchStock();
              }}
              list="suggestions"
            />
            <datalist id="suggestions">
              {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NFLX', 'NVDA'].map(
                (s) => (
                  <option key={s} value={s} />
                )
              )}
            </datalist>
            <button onClick={fetchStock} style={styles.button} disabled={loading}>
              {loading ? <LoadingSpinner /> : 'Get Data'}
            </button>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          {history.length > 0 && (
            <section style={styles.historySection}>
              <h3>Search History</h3>
              <div style={styles.historyList}>
                {history.map((h) => (
                  <button
                    key={h}
                    style={styles.historyButton}
                    onClick={() => {
                      setSymbol(h);
                      setTimeout(fetchStock, 100);
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </section>
          )}

          {stockData && (
            <section style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={styles.stockHeader}>
                  {symbol} — {stockData.date}
                </h2>
                <button
                  onClick={() => toggleFavorite(symbol)}
                  style={{
                    ...styles.favoriteBtn,
                    backgroundColor: favorites.includes(symbol)
                      ? '#f59e0b'
                      : '#e5e7eb',
                  }}
                  aria-label={
                    favorites.includes(symbol)
                      ? 'Remove from favorites'
                      : 'Add to favorites'
                  }
                >
                  ★
                </button>
              </div>

              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td style={styles.label}>Open</td>
                    <td style={styles.value}>${stockData.open.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={styles.label}>High</td>
                    <td style={styles.value}>${stockData.high.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={styles.label}>Low</td>
                    <td style={styles.value}>${stockData.low.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={styles.label}>Close</td>
                    <td style={styles.value}>
                      ${stockData.close.toFixed(2)}{' '}
                      {renderChange(stockData.close, stockData.prevClose)}
                    </td>
                  </tr>
                  <tr>
                    <td style={styles.label}>Volume</td>
                    <td style={styles.value}>
                      {stockData.volume.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>

              <button onClick={exportCSV} style={styles.exportBtn}>
                Export CSV
              </button>

              <button onClick={shareLink} style={styles.shareBtn}>
                Share Link
              </button>

              <h3 style={{ marginTop: '2rem' }}>Last 10 Days Summary</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={multiDayData}>
                    <XAxis dataKey="date" />
                    <YAxis domain={['dataMin', 'dataMax']} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <table style={styles.summaryTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Open</th>
                    <th>High</th>
                    <th>Low</th>
                    <th>Close</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {multiDayData.map((day) => (
                    <tr key={day.date}>
                      <td>{day.date}</td>
                      <td>${day.open.toFixed(2)}</td>
                      <td>${day.high.toFixed(2)}</td>
                      <td>${day.low.toFixed(2)}</td>
                      <td>${day.close.toFixed(2)}</td>
                      <td>{day.volume.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <section style={styles.newsSection}>
                <h3>Latest News</h3>
                <ul>
                  {news.map((n, i) => (
                    <li key={i}>
                      <a href={n.url} target="_blank" rel="noopener noreferrer">
                        {n.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </section>
          )}
        </main>
      </div>

      <style jsx>{`
        .background {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(ellipse at center, #0f172a 0%, #020617 80%);
          overflow: hidden;
          z-index: -1;
        }

        /* Meteorite streaks */
        .background::before,
        .background::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background-repeat: repeat;
          pointer-events: none;
          animation: streak 20s linear infinite;
          background-image:
            linear-gradient(45deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 80%);
          filter: drop-shadow(0 0 3px #38bdf8);
        }
        .background::after {
          animation-delay: 10s;
          background-image:
            linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%);
          filter: drop-shadow(0 0 2px #60a5fa);
        }

        @keyframes streak {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 1000px 1000px;
          }
        }
      `}</style>
    </>
  );
}

function LoadingSpinner() {
  return (
    <svg
      style={{ margin: 'auto', display: 'block' }}
      width="24"
      height="24"
      viewBox="0 0 38 38"
      xmlns="http://www.w3.org/2000/svg"
      stroke="#2563eb"
    >
      <g fill="none" fillRule="evenodd">
        <g transform="translate(1 1)" strokeWidth="2">
          <circle strokeOpacity=".5" cx="18" cy="18" r="18" />
          <path d="M36 18c0-9.94-8.06-18-18-18">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 18 18"
              to="360 18 18"
              dur="1s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      </g>
    </svg>
  );
}

const styles = {
  main: {
    maxWidth: '600px',
    margin: '3rem auto',
    fontFamily:
      "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    color: '#f9f9f9',
    padding: '2rem 1rem',
    backgroundColor: '#000000',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(255, 255, 255, 0.1)',

    // Streaking white lines background
    backgroundImage: `
      repeating-linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.07) 0,
        rgba(255, 255, 255, 0.07) 2px,
        transparent 2px,
        transparent 6px
      )
    `,
    backgroundSize: '200% 200%',
    animation: 'streakMove 20s linear infinite',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },

  title: {
    fontWeight: 700,
    fontSize: '2.8rem',
    color: '#fff',
    margin: 0,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },

  marketStatus: {
    fontWeight: 600,
    color: '#ddd',
    marginBottom: '1.5rem',
    fontSize: '1.2rem',
    textAlign: 'center',
    letterSpacing: '0.04em',
  },

  inputGroup: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
  },

  input: {
    flex: 1,
    padding: '0.75rem 1.2rem',
    fontSize: '1.15rem',
    borderRadius: '8px',
    border: '2px solid #fff',
    outline: 'none',
    backgroundColor: 'transparent',
    color: '#fff',
    fontWeight: 600,
    letterSpacing: '0.05em',
    transition: 'border-color 0.3s ease',
  },

  button: {
    padding: '0.75rem 2rem',
    fontSize: '1.15rem',
    borderRadius: '8px',
    border: '2px solid #fff',
    backgroundColor: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    letterSpacing: '0.05em',
    transition: 'background-color 0.3s ease, color 0.3s ease',
  },

  exportBtn: {
    marginTop: '1.2rem',
    backgroundColor: '#fff',
    border: 'none',
    color: '#000',
    padding: '0.6rem 1.4rem',
    borderRadius: '8px',
    fontWeight: 700,
    cursor: 'pointer',
    marginRight: '1rem',
    letterSpacing: '0.04em',
    boxShadow: '0 0 8px rgba(255,255,255,0.3)',
  },

  shareBtn: {
    marginTop: '1.2rem',
    backgroundColor: '#fff',
    border: 'none',
    color: '#000',
    padding: '0.6rem 1.4rem',
    borderRadius: '8px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    boxShadow: '0 0 8px rgba(255,255,255,0.3)',
  },

  error: {
    color: '#ff6b6b',
    marginBottom: '1.2rem',
    fontWeight: 700,
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#111111',
    borderRadius: '14px',
    boxShadow: '0 6px 18px rgba(255, 255, 255, 0.1)',
    padding: '2rem',
    marginTop: '1.5rem',
    color: '#eee',
  },

  stockHeader: {
    margin: '0 0 1.2rem 0',
    fontSize: '2rem',
    fontWeight: 700,
    color: '#fff',
    borderBottom: '2px solid #fff',
    paddingBottom: '0.4rem',
    letterSpacing: '0.06em',
  },

  favoriteBtn: {
    fontSize: '1.7rem',
    padding: '0 0.6rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    color: '#ffd700',
    fontWeight: 900,
    userSelect: 'none',
    transition: 'color 0.3s ease',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#eee',
    fontWeight: 600,
    letterSpacing: '0.03em',
  },

  summaryTable: {
    marginTop: '1.2rem',
    width: '100%',
    borderCollapse: 'collapse',
    color: '#eee',
  },

  label: {
    textAlign: 'left',
    padding: '0.6rem 0',
    fontWeight: 600,
    color: '#bbb',
    borderBottom: '1px solid #333',
  },

  value: {
    textAlign: 'right',
    padding: '0.6rem 0',
    fontWeight: 700,
    color: '#fff',
    borderBottom: '1px solid #333',
  },

  historySection: {
    marginBottom: '1.5rem',
  },

  historyList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.6rem',
  },

  historyButton: {
    backgroundColor: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.4rem 1rem',
    cursor: 'pointer',
    fontWeight: 700,
    color: '#000',
    letterSpacing: '0.04em',
    transition: 'background-color 0.3s ease',
  },

  newsSection: {
    marginTop: '2rem',
    color: '#eee',
  },
};
