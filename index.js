const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] // Substitua pelo seu domínio do frontend
    : ['http://localhost:4200', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist/redirect-saas')));
}

// In-memory storage (fallback)
let configs = [];

// Supabase setup (when available)
let supabase = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL || 'https://lzukjzmvcjugmfomajzx.supabase.co';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dWtqem12Y2p1Z21mb21hanp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3Nzg1MzEsImV4cCI6MjA3MTM1NDUzMX0.TDsLMdiIIR3XjRUtlG_ylJo8LGN3feQoAtipdh1Imgg';
  
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase connected successfully');
  } else {
    console.log('⚠️  Supabase not configured, using in-memory storage');
  }
} catch (error) {
  console.log('⚠️  Supabase not available, using in-memory storage');
}

// Helper functions
const validateConfig = (config) => {
  if (!config.keyword || config.keyword.length < 2) {
    return 'Keyword é obrigatória (mínimo 2 caracteres)';
  }
  
  if (!config.white_link || !isValidUrl(config.white_link)) {
    return 'Link White deve ser uma URL válida';
  }
  
  if (!config.black_link || !isValidUrl(config.black_link)) {
    return 'Link Black deve ser uma URL válida';
  }
  
  if (!['facebook', 'google'].includes(config.campaign_type)) {
    return 'Tipo de campanha deve ser facebook ou google';
  }
  
  return null;
};

const isValidUrl = (url) => {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'RedirectFlow API is running',
    timestamp: new Date().toISOString(),
    storage: supabase ? 'supabase' : 'memory'
  });
});

// Get all configurations
app.get('/api/configs', async (req, res) => {
  try {
    let data;
    
    if (supabase) {
      const { data: supabaseData, error } = await supabase
        .from('link_configs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      data = supabaseData || [];
    } else {
      data = configs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    res.json({
      success: true,
      data: data,
      count: data.length
    });
  } catch (error) {
    console.error('Error fetching configs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configurações',
      error: error.message
    });
  }
});

// Create new configuration
app.post('/api/configs', async (req, res) => {
  try {
    const config = req.body;
    
    // Validate input
    const validationError = validateConfig(config);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }
    
    // Check for duplicate keyword
    let existingConfig;
    if (supabase) {
      const { data } = await supabase
        .from('link_configs')
        .select('keyword')
        .eq('keyword', config.keyword)
        .single();
      existingConfig = data;
    } else {
      existingConfig = configs.find(c => c.keyword === config.keyword);
    }
    
    if (existingConfig) {
      return res.status(400).json({
        success: false,
        message: 'Keyword já existe. Use uma keyword única.'
      });
    }
    
    // Create new config
    const newConfig = {
      id: uuidv4(),
      keyword: config.keyword.trim(),
      white_link: config.white_link.trim(),
      black_link: config.black_link.trim(),
      campaign_type: config.campaign_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (supabase) {
      const { data, error } = await supabase
        .from('link_configs')
        .insert([newConfig])
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(201).json({
        success: true,
        data: data,
        message: 'Configuração criada com sucesso'
      });
    } else {
      configs.push(newConfig);
      res.status(201).json({
        success: true,
        data: newConfig,
        message: 'Configuração criada com sucesso'
      });
    }
  } catch (error) {
    console.error('Error creating config:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar configuração',
      error: error.message
    });
  }
});

// Delete configuration
app.delete('/api/configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID é obrigatório'
      });
    }
    
    if (supabase) {
      const { error } = await supabase
        .from('link_configs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      res.json({
        success: true,
        message: 'Configuração deletada com sucesso'
      });
    } else {
      const index = configs.findIndex(c => c.id === id);
      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: 'Configuração não encontrada'
        });
      }
      
      configs.splice(index, 1);
      res.json({
        success: true,
        message: 'Configuração deletada com sucesso'
      });
    }
  } catch (error) {
    console.error('Error deleting config:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar configuração',
      error: error.message
    });
  }
});

// Check keyword and get redirect URL
app.get('/api/check', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.json({
        redirect: false,
        message: 'Keyword não fornecida'
      });
    }
    
    let config;
    if (supabase) {
      const { data, error } = await supabase
        .from('link_configs')
        .select('*')
        .eq('keyword', keyword.trim())
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }
      config = data;
    } else {
      config = configs.find(c => c.keyword === keyword.trim());
    }
    
    if (config) {
      res.json({
        redirect: true,
        url: config.black_link,
        keyword: config.keyword,
        campaign_type: config.campaign_type
      });
    } else {
      res.json({
        redirect: false,
        message: 'Keyword não encontrada'
      });
    }
  } catch (error) {
    console.error('Error checking keyword:', error);
    res.status(500).json({
      redirect: false,
      message: 'Erro ao verificar keyword',
      error: error.message
    });
  }
});

// Serve Angular app for any non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/redirect-saas/index.html'));
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    path: req.path
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 RedirectFlow API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
  console.log(`💾 Storage: ${supabase ? 'Supabase' : 'Memory'}`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log(`🌐 Frontend served from: /dist/redirect-saas`);
  }
});

module.exports = app;