const express = require('express');
const trends = require('google-trends-api');
const qs = require('qs'); // ✅ Use qs instead of querystring

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ Correct parser for repeated query params like keyword=a&keyword=b
app.set('query parser', (str) => qs.parse(str));

app.get('/api/trends', async (req, res) => {
  let keywords = req.query.keyword || 'AI';
  const geo = req.query.geo || 'US';

  // ✅ Normalize to array
  if (!Array.isArray(keywords)) {
    keywords = [keywords];
  }

  // ✅ Parse optional date inputs
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

    // ✅ Add keyword count + metadata
    res.json({
      ...parsedResults,
      searchedKeywordCount: keywords.length,
      searchMeta: {
        keywords,
        geo,
        startTime: startTime?.toISOString() || 'default',
        endTime: endTime?.toISOString() || 'now',
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Health check
app.get('/', (req, res) => {
  res.send('✅ Google Trends API is running');
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
