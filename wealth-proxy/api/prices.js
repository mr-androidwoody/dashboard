// api/prices.js
// Fetches: Publicis (EUR->GBP) and Bitcoin (GBP)
// Vanguard is fetched directly by the browser - no proxy needed

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300'); // cache 5 mins

  try {
    const [publicis, bitcoin, fx] = await Promise.allSettled([
      fetchYahoo('PUB.PA'),
      fetchBitcoin(),
      fetchFX()
    ]);

    const fxRates = fx.status === 'fulfilled' ? fx.value : { EURGBP: 0.856 };

    res.status(200).json({
      timestamp: new Date().toISOString(),
      PUBPA: publicis.status === 'fulfilled'
        ? { ...publicis.value, priceGBP: publicis.value.price * fxRates.EURGBP, fxRate: fxRates.EURGBP }
        : null,
      BTC: bitcoin.status === 'fulfilled' ? bitcoin.value : null,
      fx: fxRates
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function fetchYahoo(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`Yahoo ${ticker}: ${r.status}`);
  const data = await r.json();
  const meta = data.chart.result[0].meta;
  return {
    price: meta.regularMarketPrice,
    currency: meta.currency,
    asOfDate: new Date(meta.regularMarketTime * 1000).toISOString().split('T')[0],
    change: meta.regularMarketPrice - meta.previousClose,
  };
}

async function fetchBitcoin() {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=gbp&include_24hr_change=true';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`CoinGecko: ${r.status}`);
  const data = await r.json();
  return {
    priceGBP: data.bitcoin.gbp,
    changePct: data.bitcoin.gbp_24h_change?.toFixed(2) + '%',
    asOfDate: new Date().toISOString().split('T')[0]
  };
}

async function fetchFX() {
  const url = 'https://api.frankfurter.app/latest?from=EUR&to=GBP';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FX: ${r.status}`);
  const data = await r.json();
  return { EURGBP: data.rates.GBP, asOfDate: data.date };
}
