import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const symbol = req.query.symbol;

  if (!symbol || typeof symbol !== 'string') {
    res.status(400).json({ error: 'Missing symbol parameter' });
    return;
  }

  const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

  if (!API_KEY) {
    console.error('API key missing!');
    res.status(500).json({ error: 'API key not set in environment variables' });
    return;
  }

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      console.error('Alpha Vantage response not OK:', response.status, text);
      res.status(response.status).json({ error: `Alpha Vantage error: ${text}` });
      return;
    }

    const data = await response.json();

    if (data['Error Message']) {
      console.error('Alpha Vantage error message:', data['Error Message']);
      res.status(500).json({ error: data['Error Message'] });
      return;
    }

    if (data['Note']) {
      console.error('Alpha Vantage rate limit notice:', data['Note']);
      res.status(429).json({ error: data['Note'] });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
}
