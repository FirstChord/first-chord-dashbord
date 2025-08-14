// Simple standalone API script to test outside Next.js
const express = require('express');
const app = express();

app.get('/students', async (req, res) => {
  try {
    const mmsToken = process.env.MMS_DEFAULT_TOKEN;
    if (!mmsToken) {
      return res.status(500).json({ error: 'MMS token not configured' });
    }

    const response = await fetch('https://app.mymusicstaff.com/api/StudentAPI/Students', {
      headers: {
        'Authorization': `Bearer ${mmsToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'MMS API error' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
