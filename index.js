const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

// Configuração do banco de dados (conexão via rede interna!)
const pool = new Pool({
  host: process.env.PGHOST || 'postgres.railway.internal',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'railway',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  ssl: false // Conexão interna não precisa de SSL
});

// Testar conexão ao iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco:', err.stack);
  } else {
    console.log('✅ Conectado ao PostgreSQL com sucesso!');
    release();
  }
});

// Configurar EJS como template engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Servir arquivos estáticos (CSS simples)
app.use(express.static('public'));

// Rota principal - Dashboard
app.get('/', async (req, res) => {
  try {
    // Buscar contatos
    const contactsResult = await pool.query(`
      SELECT * FROM contacts 
      ORDER BY created_at DESC 
      LIMIT 50
    `);
    
    // Buscar conversas recentes
    const conversationsResult = await pool.query(`
      SELECT 
        c.id as conversation_id,
        c.status,
        c.last_message,
        c.last_message_at,
        ct.id as contact_id,
        ct.phone_number,
        ct.name
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      ORDER BY c.last_message_at DESC 
      LIMIT 20
    `);
    
    // Buscar últimas mensagens (com campos específicos)
    const messagesResult = await pool.query(`
      SELECT 
        m.id,
        m.content,
        m.direction,
        m.type,
        m.created_at,
        ct.phone_number,
        ct.name
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN contacts ct ON c.contact_id = ct.id
      ORDER BY m.created_at DESC 
      LIMIT 50
    `);
    
    // Estatísticas rápidas
    const statsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM contacts) as total_contacts,
        (SELECT COUNT(*) FROM conversations) as total_conversations,
        (SELECT COUNT(*) FROM messages) as total_messages,
        (SELECT COUNT(*) FROM messages WHERE direction = 'incoming') as incoming_messages,
        (SELECT COUNT(*) FROM messages WHERE direction = 'outgoing') as outgoing_messages
    `);
    
    res.render('dashboard', {
      contacts: contactsResult.rows,
      conversations: conversationsResult.rows,
      messages: messagesResult.rows,
      stats: statsResult.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar dados:', error);
    res.status(500).send('Erro ao carregar dashboard: ' + error.message);
  }
});

// Rota para ver detalhes de uma conversa específica
app.get('/conversa/:id', async (req, res) => {
  try {
    const conversationId = req.params.id;
    
    const messagesResult = await pool.query(`
      SELECT 
        m.id,
        m.content,
        m.direction,
        m.type,
        m.created_at,
        ct.phone_number,
        ct.name
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN contacts ct ON c.contact_id = ct.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [conversationId]);
    
    const conversationResult = await pool.query(`
      SELECT * FROM conversations WHERE id = $1
    `, [conversationId]);
    
    if (conversationResult.rows.length === 0) {
      return res.status(404).send('Conversa não encontrada');
    }
    
    res.render('conversa', {
      messages: messagesResult.rows,
      conversation: conversationResult.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar conversa:', error);
    res.status(500).send('Erro ao carregar conversa');
  }
});

// Rota para chat estilo WhatsApp
app.get('/chat/:id', async (req, res) => {
  try {
    const conversationId = req.params.id;
    
    // Busca a conversa
    const conversationResult = await pool.query(`
      SELECT * FROM conversations WHERE id = $1
    `, [conversationId]);
    
    if (conversationResult.rows.length === 0) {
      return res.status(404).send('Conversa não encontrada');
    }
    
    const conversation = conversationResult.rows[0];
    
    // Busca o contato
    const contactResult = await pool.query(`
      SELECT * FROM contacts WHERE id = $1
    `, [conversation.contact_id]);
    
    const contact = contactResult.rows[0];
    
    // Busca as mensagens da conversa
    const messagesResult = await pool.query(`
      SELECT 
        m.id,
        m.content,
        m.direction,
        m.type,
        m.created_at,
        ct.phone_number,
        ct.name
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN contacts ct ON c.contact_id = ct.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [conversationId]);
    
    res.render('chat', {
      conversation,
      contact,
      messages: messagesResult.rows
    });
    
  } catch (error) {
    console.error('❌ Erro no chat:', error);
    res.status(500).send('Erro ao carregar chat');
  }
});

// Rota de saúde (para o Railway)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 Dashboard rodando na porta ${port}`);
});
