const express = require('express');
const trends = require('google-trends-api');
const querystring = require('querystring');

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ Fix query parsing for repeated parameters (e.g., keyword=...&keyword=...)
app.set('query parser', (str) => querystring.parse(str));

app.get('/api/trends', async (req, res) => {
  let keywords = req.query.keyword || 'AI';
  const geo = req.query.geo || 'US';

  // ✅ Normalize single string to array
  if (!Array.isArray(keywords)) {
    keywords = [keywords];
  }

  // ✅ Optional date range handling
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

    // ✅ Return with metadata
    res.json({
      ...parsedResults,
      searchedKeywordCount: keywords.length,
      searchMeta: {
        keywords,
        geo,
        startTime: startTime ? startTime.toISOString() : 'default',
        endTime: endTime ? endTime.toISOString() : 'now',
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🟢 Health check
app.get('/', (req, res) => {
  res.send('✅ Google Trends API is running');
});

// 🚀 Launch server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
