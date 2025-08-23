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

// Debug: confirmar conexão
console.log("✅ Supabase client inicializado:", supabaseUrl);

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
    fetch('/api/check?keyword=' + urlParams.get('keyword'))
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
  console.log("📩 [POST /api/configs] Payload recebido:", req.body);
  try {
    const { keyword, whiteLink, blackLink, campaignType } = req.body;
    
    // Validate required fields
    if (!keyword || !whiteLink || !blackLink || !campaignType) {
      console.warn("⚠️ Campos obrigatórios faltando:", req.body);
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if keyword already exists
    const { data: existing, error: existingError } = await supabase
      .from('link_configs')
      .select('*')
      .eq('keyword', keyword)
      .maybeSingle();

    if (existingError) {
      console.error("❌ Erro ao buscar keyword:", existingError);
    }

    if (existing) {
      console.warn("⚠️ Keyword já existe:", keyword);
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
      console.error('❌ Erro ao inserir no Supabase:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }
    
    console.log("✅ Config criada:", data);

    // Generate UTM and script
    const utm = generateUTM(campaignType, keyword);
    const script = generateScript(keyword);
    const apiUrl = `${process.env.BASE_URL || `http://localhost:${PORT}`}/api/check?keyword=${keyword}`;
    
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
    console.error('❌ Erro no servidor [POST /api/configs]:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get all configurations
app.get('/api/configs', async (req, res) => {
  console.log("📩 [GET /api/configs]");
  try {
    const { data, error } = await supabase
      .from('link_configs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erro ao buscar configs:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }
    
    console.log("✅ Configs retornadas:", data.length);
    res.json(data);
  } catch (error) {
    console.error('❌ Erro no servidor [GET /api/configs]:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Delete configuration
app.delete('/api/configs/:id', async (req, res) => {
  console.log("📩 [DELETE /api/configs/:id]", req.params);
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('link_configs')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('❌ Erro ao deletar config:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }
    
    console.log("✅ Config deletada:", id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro no servidor [DELETE /api/configs/:id]:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Check keyword and redirect
app.get('/api/configs/check', async (req, res) => {
  console.log("📩 [GET /api/configs/check]", req.query);
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.json({ redirect: false, message: 'No keyword provided' });
    }
    
    const { data, error } = await supabase
      .from('link_configs')
      .select('*')
      .eq('keyword', keyword)
      .maybeSingle();
    
    if (error) {
      console.error("❌ Erro ao buscar keyword:", error);
      return res.json({ redirect: false, message: 'Database error', details: error.message });
    }

    if (!data) {
      console.warn("⚠️ Keyword não encontrada:", keyword);
      return res.json({ redirect: false, message: 'Keyword not found' });
    }
    
    console.log("✅ Keyword encontrada:", data);
    res.json({
      redirect: true,
      url: data.black_link,
      message: 'Keyword verified'
    });
  } catch (error) {
    console.error('❌ Erro no servidor [GET /api/configs/check]:', error);
    res.json({ redirect: false, message: 'Server error', details: error.message });
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
