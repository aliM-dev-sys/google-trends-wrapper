const express = require('express');
const trends = require('google-trends-api');
const app = express();

const PORT = process.env.PORT || 3001;

app.get('/api/trends', async (req, res) => {
  let keywords = req.query.keyword || 'AI';
  const geo = req.query.geo || 'US';

  // Normalize single vs multiple keyword inputs
  if (!Array.isArray(keywords)) {
    keywords = [keywords];
  }

  // Optional date range support
  const startTime = req.query.startTime ? new Date(req.query.startTime) : undefined;
  const endTime = req.query.endTime ? new Date(req.query.endTime) : undefined;

  try {
    const options = {
      keyword: keywords,
      geo,
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
    };

    const results = await trends.interestOverTime(options);
    const parsed = JSON.parse(results);

    // Add count to response
    parsed.searchedKeywordCount = keywords.length;

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Google Trends API is running ✅');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
