import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Activity, Users, Landmark, Search, 
  TrendingUp, ArrowRightLeft, DollarSign, X, ChevronRight, AlertCircle
} from 'lucide-react';

// --- Utility Functions ---
const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
const formatCompact = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);

const parseAmount = (amountStr) => {
  if (!amountStr) return 0;
  if (amountStr.toLowerCase().includes('over')) return 50000000;
  
  const matches = amountStr.replace(/,/g, '').match(/\d+/g);
  if (matches && matches.length === 2) {
    const min = parseInt(matches[0], 10);
    const max = parseInt(matches[1], 10);
    return (min + max) / 2;
  }
  if (matches && matches.length === 1) {
    return parseInt(matches[0], 10);
  }
  return 1000;
};

const cleanTicker = (ticker) => {
  if (!ticker || ticker === '--') return 'Unknown';
  return ticker.replace(/<[^>]*>?/gm, '').trim().toUpperCase();
};

const getTypeColor = (type) => {
  const t = type.toLowerCase();
  if(t.includes('purchase')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  if(t.includes('sale')) return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
  if(t.includes('exchange')) return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
  return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
};

const MOCK_DATA = [
  { transaction_date: "04/28/2026", ticker: "NVDA", type: "Purchase", amount: "$1,000,001 - $5,000,000", senator: "Nancy Pelosi", chamber: "House", asset_description: "NVIDIA Corp" },
  { transaction_date: "04/25/2026", ticker: "AAPL", type: "Sale (Full)", amount: "$500,001 - $1,000,000", senator: "Tommy Tuberville", chamber: "Senate", asset_description: "Apple Inc" },
  { transaction_date: "04/22/2026", ticker: "MSFT", type: "Purchase", amount: "$250,001 - $500,000", senator: "Ro Khanna", chamber: "House", asset_description: "Microsoft Corp" },
  { transaction_date: "04/18/2026", ticker: "LMT", type: "Purchase", amount: "$100,001 - $250,000", senator: "Dan Crenshaw", chamber: "House", asset_description: "Lockheed Martin" },
  { transaction_date: "04/15/2026", ticker: "TSLA", type: "Sale (Partial)", amount: "$50,001 - $100,000", senator: "Markwayne Mullin", chamber: "Senate", asset_description: "Tesla Inc" },
  { transaction_date: "04/10/2026", ticker: "META", type: "Purchase", amount: "$1,000,001 - $5,000,000", senator: "Nancy Pelosi", chamber: "House", asset_description: "Meta Platforms" },
  { transaction_date: "04/05/2026", ticker: "CRWD", type: "Purchase", amount: "$15,001 - $50,000", senator: "Ron Wyden", chamber: "Senate", asset_description: "Crowdstrike" },
  { transaction_date: "03/30/2026", ticker: "AMZN", type: "Purchase", amount: "$250,001 - $500,000", senator: "Josh Hawley", chamber: "Senate", asset_description: "Amazon.com" },
  { transaction_date: "03/25/2026", ticker: "GOOGL", type: "Sale (Full)", amount: "$1,000,001 - $5,000,000", senator: "Nancy Pelosi", chamber: "House", asset_description: "Alphabet Inc" },
  { transaction_date: "03/20/2026", ticker: "PLTR", type: "Purchase", amount: "$50,001 - $100,000", senator: "Dan Crenshaw", chamber: "House", asset_description: "Palantir Tech" }
];

const normalizeTrade = (item, chamber) => {
  const isHouse = chamber === 'House';
  const name = isHouse ? item.representative : item.senator;
  
  return {
    id: `${name}-${item.transaction_date}-${item.ticker}-${Math.random().toString(36).substr(2, 9)}`,
    politician: name || "Unknown",
    chamber: chamber,
    date: item.transaction_date || item.disclosure_date,
    ticker: cleanTicker(item.ticker),
    assetDescription: item.asset_description || "Unknown Asset",
    type: item.type ? item.type : 'Unknown',
    amountStr: item.amount,
    amountVal: parseAmount(item.amount),
    link: item.ptr_link
  };
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Connecting to Capitol Records...");
  const [data, setData] = useState({ trades: [], politicians: [], totalVolume: 0, totalTrades: 0, isMock: false });
  const [activeTab, setActiveTab] = useState('portfolios'); // 'portfolios' | 'feed'
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPol, setSelectedPol] = useState(null);

  const loadingTexts = [
    "Connecting to Capitol Records...",
    "Parsing Periodic Transaction Reports...",
    "Running OCR on Disclosures...",
    "Reconstructing Historical Portfolios...",
    "Estimating Volume & Trade Weights..."
  ];

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingText(texts => {
          const currentIndex = loadingTexts.indexOf(texts);
          return loadingTexts[(currentIndex + 1) % loadingTexts.length];
        });
      }, 800);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [senateRes, houseRes] = await Promise.allSettled([
          fetch('https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json'),
          fetch('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json')
        ]);

        let allTrades = [];

        if (senateRes.status === 'fulfilled') {
          const senateJson = await senateRes.value.json();
          allTrades = [...allTrades, ...senateJson.map(item => normalizeTrade(item, 'Senate'))];
        }
        if (houseRes.status === 'fulfilled') {
          const houseJson = await houseRes.value.json();
          allTrades = [...allTrades, ...houseJson.map(item => normalizeTrade(item, 'House'))];
        }

        if (allTrades.length === 0) throw new Error("Could not fetch remote datasets.");
        processTrades(allTrades, false);

      } catch (err) {
        console.warn("Failed to fetch live data (likely CORS), using embedded fallback data.", err);
        const mockProcessed = MOCK_DATA.map(item => normalizeTrade(item, item.chamber));
        processTrades(mockProcessed, true);
      }
    };

    fetchData();
  }, []);

  const processTrades = (trades, isMock) => {
    let validTrades = trades.filter(t => t.date && !isNaN(new Date(t.date).getTime()));
    validTrades.sort((a, b) => new Date(b.date) - new Date(a.date));

    const pols = {};
    let totalVol = 0;
    
    validTrades.forEach(trade => {
      if (!trade.politician || trade.politician.toLowerCase() === 'unknown') return;
      
      if (!pols[trade.politician]) {
        pols[trade.politician] = {
          name: trade.politician,
          chamber: trade.chamber,
          totalVolume: 0,
          tradeCount: 0,
          portfolio: {},
          recentTrades: []
        };
      }
      
      const p = pols[trade.politician];
      p.totalVolume += trade.amountVal;
      totalVol += trade.amountVal;
      p.tradeCount += 1;
      
      if (p.recentTrades.length < 50) p.recentTrades.push(trade);
      
      if (trade.ticker !== 'Unknown') {
        if (!p.portfolio[trade.ticker]) p.portfolio[trade.ticker] = 0;
        if (trade.type.toLowerCase().includes('purchase')) p.portfolio[trade.ticker] += trade.amountVal;
        if (trade.type.toLowerCase().includes('sale')) p.portfolio[trade.ticker] -= trade.amountVal;
      }
    });

    const topPoliticians = Object.values(pols)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 100);

    setData({
      trades: validTrades.slice(0, 200), // Top 200 for feed
      politicians: topPoliticians,
      totalVolume: totalVol,
      totalTrades: validTrades.length,
      isMock
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-medium tracking-wide mb-2">Quiver-Style Engine Initialization</h2>
        <p className="text-slate-400 font-mono text-sm animate-pulse">{loadingText}</p>
      </div>
    );
  }

  const filteredPoliticians = data.politicians.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
      
      {/* Top Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Landmark size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Capitol Tracker</span>
            {data.isMock && (
              <span className="ml-4 px-2 py-1 bg-amber-500/10 text-amber-400 text-[10px] uppercase font-bold tracking-wider rounded border border-amber-500/20 flex items-center gap-1">
                <AlertCircle size={10} /> Local Mode
              </span>
            )}
          </div>
          <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button 
              onClick={() => setActiveTab('portfolios')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'portfolios' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Top Portfolios
            </button>
            <button 
              onClick={() => setActiveTab('feed')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'feed' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Live Feed
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-2">
              <DollarSign size={18} className="text-emerald-400" />
              <h3 className="font-medium text-sm">Estimated Volume Tracked</h3>
            </div>
            <p className="text-3xl font-bold text-white">{formatCompact(data.totalVolume)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-2">
              <Activity size={18} className="text-blue-400" />
              <h3 className="font-medium text-sm">Total Disclosures</h3>
            </div>
            <p className="text-3xl font-bold text-white">{new Intl.NumberFormat('en-US').format(data.totalTrades)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-3 text-slate-400 mb-2">
              <Users size={18} className="text-indigo-400" />
              <h3 className="font-medium text-sm">Active Politicians</h3>
            </div>
            <p className="text-3xl font-bold text-white">{data.politicians.length}</p>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'portfolios' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/50">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-400" /> Congressional Leaderboard
              </h2>
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search politicians..." 
                  className="w-full bg-slate-950 border border-slate-800 text-sm rounded-lg pl-9 pr-4 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-4 px-6 font-medium w-16">Rank</th>
                    <th className="py-4 px-6 font-medium">Politician</th>
                    <th className="py-4 px-6 font-medium">Chamber</th>
                    <th className="py-4 px-6 font-medium text-right">Est. Traded Volume</th>
                    <th className="py-4 px-6 font-medium text-right w-24">Trades</th>
                    <th className="py-4 px-6 font-medium text-right w-32">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredPoliticians.map((pol, idx) => (
                    <tr key={pol.name} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="py-4 px-6 text-slate-500 font-mono text-xs">{idx + 1}</td>
                      <td className="py-4 px-6 font-medium text-slate-200">{pol.name}</td>
                      <td className="py-4 px-6 text-slate-400">{pol.chamber}</td>
                      <td className="py-4 px-6 text-right font-mono text-slate-300">{formatCurrency(pol.totalVolume)}</td>
                      <td className="py-4 px-6 text-right text-slate-400">{pol.tradeCount}</td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => setSelectedPol(pol)} 
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded text-xs font-medium transition-all opacity-80 group-hover:opacity-100 border border-blue-500/20"
                        >
                          View <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPoliticians.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-500">No politicians found matching "{searchTerm}"</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
            <div className="p-5 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity size={18} className="text-emerald-400" /> Latest Disclosures Feed
              </h2>
            </div>
            <div className="divide-y divide-slate-800/50">
              {data.trades.map((trade) => (
                <div key={trade.id} className="p-5 hover:bg-slate-800/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-12 h-12 rounded bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-slate-300 font-mono text-sm shrink-0">
                      {trade.ticker}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-slate-200">{trade.politician}</h4>
                        <span className="text-xs text-slate-500 border border-slate-800 bg-slate-950 px-2 py-0.5 rounded">{trade.chamber}</span>
                      </div>
                      <p className="text-sm text-slate-400">{trade.assetDescription}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-1 shrink-0">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded border text-xs font-medium uppercase tracking-wider ${getTypeColor(trade.type)}`}>
                        {trade.type}
                      </span>
                      <span className="font-mono text-slate-200 text-sm whitespace-nowrap">{trade.amountStr}</span>
                    </div>
                    <span className="text-xs text-slate-500">Transacted: {trade.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Politician Detail Modal */}
      {selectedPol && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900/80 backdrop-blur">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{selectedPol.name}</h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-slate-400"><Landmark size={14} /> {selectedPol.chamber}</span>
                  <span className="flex items-center gap-1.5 text-slate-400"><DollarSign size={14} /> Traded: {formatCompact(selectedPol.totalVolume)}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPol(null)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-5 gap-8">
              
              {/* Left Col: Modeled Portfolio */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <BarChart3 size={18} className="text-blue-400"/> Estimated Holdings
                  </h3>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Visualized net positions mathematically derived from public purchase/sale disclosures. (Excludes assets held prior to tracking records).
                  </p>
                  
                  {(() => {
                    const holdings = Object.entries(selectedPol.portfolio)
                      .filter(([_, val]) => val > 0)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 10);
                      
                    if (holdings.length === 0) {
                      return (
                        <div className="p-6 bg-slate-950/50 rounded-xl text-slate-500 text-sm border border-slate-800/50 text-center flex flex-col items-center gap-2">
                          <AlertCircle size={24} className="text-slate-600 mb-1" />
                          <p>No positive net positions able to be mathematically modeled from available disclosure data.</p>
                        </div>
                      );
                    }

                    const maxVal = holdings[0][1];

                    return (
                      <div className="space-y-4">
                        {holdings.map(([ticker, val]) => (
                          <div key={ticker} className="group">
                            <div className="flex justify-between text-sm mb-1.5">
                              <span className="font-mono font-bold text-slate-300 group-hover:text-blue-400 transition-colors">{ticker}</span>
                              <span className="text-slate-400 font-mono text-xs">{formatCurrency(val)}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
                              <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full relative" style={{ width: `${(val / maxVal) * 100}%` }}>
                                <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              {/* Right Col: Recent Trades List */}
              <div className="lg:col-span-3">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <ArrowRightLeft size={18} className="text-indigo-400"/> Recent Filings
                </h3>
                <div className="space-y-3 pr-2">
                  {selectedPol.recentTrades.map(trade => (
                    <div key={trade.id} className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getTypeColor(trade.type)}`}>
                            {trade.type}
                          </span>
                          <span className="text-sm font-medium text-slate-300">{trade.assetDescription}</span>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">{trade.date}</span>
                      </div>
                      <div className="flex justify-between items-end mt-3">
                        <span className="text-xl font-black font-mono text-slate-200 tracking-tight">{trade.ticker}</span>
                        <span className="text-sm text-slate-400 font-mono">{trade.amountStr}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}