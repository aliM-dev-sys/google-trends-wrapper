const express = require('express');
const trends = require('google-trends-api');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/api/trends', async (req, res) => {
  const keyword = req.query.keyword || 'AI';
  try {
    const results = await trends.interestOverTime({ keyword, geo: 'US' });
    res.json(JSON.parse(results));
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
