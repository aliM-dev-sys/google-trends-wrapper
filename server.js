const express = require('express');
const trends = require('google-trends-api');
const app = express();

const PORT = process.env.PORT || 3001;

app.get('/api/trends', async (req, res) => {
  let keywords = req.query.keyword || 'AI';
  const geo = req.query.geo || 'US';

  // Normalize single vs multiple keywords
  if (!Array.isArray(keywords)) {
    keywords = [keywords];
  }

  // Optional date range parsing
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
    const parsedResults = JSON.parse(results);

    // Attach keyword count to output
    res.json({
      ...parsedResults,
      searchedKeywordCount: keywords.length,
      searchMeta: {
        keywords,
        geo,
        startTime: startTime?.toISOString() || 'default',
        endTime: endTime?.toISOString() || 'now',
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ Google Trends API is running');
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
