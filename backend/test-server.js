const express = require('express');
const app = express();
const PORT = 3001;

// Simple health check without middleware
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Test Server'
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
