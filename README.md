# RedirectFlow API

API Node.js/Express para o sistema de redirecionamento inteligente baseado em keywords.

## 🚀 Funcionalidades

- **CRUD de Configurações**: Criar, listar e deletar configurações de redirecionamento
- **Verificação de Keywords**: Endpoint para verificar keywords e retornar URLs de redirecionamento
- **Integração Supabase**: Persistência de dados com fallback para memória
- **CORS Configurado**: Suporte para desenvolvimento e produção
- **Validação Robusta**: Validação de dados de entrada e URLs
- **Health Check**: Endpoint para monitoramento da API

## 📋 Endpoints

### Configurações
- `GET /api/configs` - Listar todas as configurações
- `POST /api/configs` - Criar nova configuração
- `DELETE /api/configs/:id` - Deletar configuração

### Verificação
- `GET /api/check?keyword=X` - Verificar keyword e obter redirecionamento

### Monitoramento
- `GET /api/health` - Status da API

## 🔧 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Executar em desenvolvimento
npm run dev

# Executar em produção
npm start
```

## 🌍 Variáveis de Ambiente

```bash
# Supabase (opcional)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# Servidor
PORT=3000
NODE_ENV=development

# CORS (produção)
CORS_ORIGINS=https://your-domain.com
```

## 🚀 Deploy no Render.com

1. Faça push do código para GitHub
2. Crie um Web Service no Render.com
3. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Root Directory**: `api`
4. Adicione as variáveis de ambiente necessárias

## 📊 Estrutura de Dados

```javascript
{
  id: "uuid",
  keyword: "promocao2024",
  white_link: "https://exemplo.com/white",
  black_link: "https://exemplo.com/black", 
  campaign_type: "facebook", // ou "google"
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z"
}
```

## 🔐 Segurança

- Validação de entrada em todos os endpoints
- Sanitização de URLs
- CORS configurado adequadamente
- Rate limiting (pode ser implementado)
- Logs detalhados para monitoramento

## 📝 Exemplo de Uso

```javascript
// Criar configuração
POST /api/configs
{
  "keyword": "promocao2024",
  "white_link": "https://exemplo.com/white",
  "black_link": "https://exemplo.com/black",
  "campaign_type": "facebook"
}

// Verificar keyword
GET /api/check?keyword=promocao2024
// Retorna: { redirect: true, url: "https://exemplo.com/black" }
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.