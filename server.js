const express = require('express');
const trends = require('google-trends-api');
const qs = require('qs');

const app = express();
const PORT = process.env.PORT || 3001;

// Only allow these geos (US, Canada, United Kingdom)
const allowedGeos = ['US', 'CA', 'GB'];

// Correct parser for repeated query params like keyword=a&keyword=b
app.set('query parser', (str) => qs.parse(str));

// Add CORS headers to handle cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Function to parse keywords from different formats
function parseKeywords(input) {
  if (!input) return ['AI']; // Default fallback
  
  // If it's already an array, return it
  if (Array.isArray(input)) {
    return input;
  }
  
  // If it's a string, try to parse different formats
  if (typeof input === 'string') {
    // Handle bracket notation: [keyword1, keyword2, keyword3]
    if (input.startsWith('[') && input.endsWith(']')) {
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        // If JSON parsing fails, treat as comma-separated
        return input.slice(1, -1).split(',').map(k => k.trim());
      }
    }
    
    // Handle comma-separated values
    if (input.includes(',')) {
      return input.split(',').map(k => k.trim());
    }
    
    // Handle pipe-separated values
    if (input.includes('|')) {
      return input.split('|').map(k => k.trim());
    }
    
    // Handle semicolon-separated values
    if (input.includes(';')) {
      return input.split(';').map(k => k.trim());
    }
    
    // Single keyword
    return [input.trim()];
  }
  
  return ['AI']; // Fallback
}

// Function to add delays and retry logic for Google Trends API
async function callGoogleTrendsWithRetry(options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} - Calling Google Trends API`);
      
      // Add random delay to avoid rate limiting
      if (attempt > 1) {
        const delay = Math.random() * 2000 + 1000; // 1-3 seconds
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const results = await trends.interestOverTime(options);
      
      // Check if results look like HTML (error page)
      if (results.trim().startsWith('<')) {
        throw new Error('Google Trends API returned HTML error page');
      }
      
      return results;
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Check if it's a rate limit or blocking issue
      if (error.message.includes('rate limit') || 
          error.message.includes('blocked') || 
          error.message.includes('HTML error page') ||
          error.message.includes('CAPTCHA')) {
        console.log('Detected rate limiting or blocking, will retry...');
        continue;
      }
      
      // For other errors, don't retry
      throw error;
    }
  }
}

app.get('/api/trends', async (req, res) => {
  // Log incoming query for debugging
  console.log('Received query:', req.query);

  // Parse keywords from various formats
  let keywords = req.query.keyword || req.query.keywords || 'AI';
  let geo = req.query.geo || 'US';

  // Restrict geo to allowed list, fallback to US if not allowed
  if (!allowedGeos.includes(geo)) {
    console.log(`Geo '${geo}' not allowed, defaulting to 'US'`);
    geo = 'US';
  }

  // Parse keywords using the new function
  keywords = parseKeywords(keywords);
  console.log('Parsed keywords:', keywords);

  // Parse optional date inputs
  const startTime = req.query.startTime ? new Date(req.query.startTime) : undefined;
  const endTime = req.query.endTime ? new Date(req.query.endTime) : undefined;

  try {
    const options = {
      keyword: keywords,
      geo,
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
    };

    console.log('Calling Google Trends API with options:', options);

    // Use retry logic
    const results = await callGoogleTrendsWithRetry(options);
    const parsedResults = JSON.parse(results);

    // Add keyword count + metadata
    res.json({
      ...parsedResults,
      searchedKeywordCount: keywords.length,
      searchMeta: {
        keywords,
        geo,
        startTime: startTime?.toISOString() || 'default',
        endTime: endTime?.toISOString() || 'now',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Google Trends API error:', error.message);
    
    // Check if it's a rate limit or blocking issue
    if (error.message.includes('rate limit') || 
        error.message.includes('blocked') || 
        error.message.includes('HTML error page') ||
        error.message.includes('CAPTCHA')) {
      return res.status(429).json({ 
        error: 'Rate limited by Google Trends',
        message: 'Too many requests to Google Trends API. Please try again later.',
        retryAfter: 300, // 5 minutes
        details: error.message
      });
    }
    
    // Return fallback data for other errors
    console.log('Returning fallback data due to API error');
    res.json({
      default: {
        timelineData: Array.from({length: 30}, (_, i) => ({
          time: new Date(Date.now() - (29-i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          value: [Math.floor(Math.random() * 100) + 1]
        }))
      },
      searchedKeywordCount: keywords.length,
      searchMeta: {
        keywords,
        geo,
        startTime: startTime?.toISOString() || 'default',
        endTime: endTime?.toISOString() || 'now',
        timestamp: new Date().toISOString(),
        fallback: true,
        error: error.message
      },
    });
  }
});

// New endpoint for testing keyword parsing
app.get('/api/test-keywords', (req, res) => {
  const testInputs = [
    'single keyword',
    'keyword1,keyword2,keyword3',
    'keyword1|keyword2|keyword3',
    'keyword1;keyword2;keyword3',
    '["keyword1", "keyword2", "keyword3"]',
    ['keyword1', 'keyword2', 'keyword3']
  ];
  
  const results = testInputs.map(input => ({
    input,
    parsed: parseKeywords(input)
  }));
  
  res.json({
    message: 'Keyword parsing test results',
    results
  });
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: '✅ Google Trends API is running',
    version: '2.0.0',
    features: [
      'Multiple keyword formats support',
      'Retry logic with delays',
      'Fallback data on errors',
      'CORS enabled',
      'Rate limit handling'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Features: Multiple keyword formats, retry logic, fallback data`);
  console.log(`🔗 Test endpoint: http://localhost:${PORT}/api/test-keywords`);
});
