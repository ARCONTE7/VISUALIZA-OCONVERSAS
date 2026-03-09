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
    
    // Buscar mensagens (SEM FILTRO DE TYPE)
    const messagesResult = await pool.query(`
      SELECT 
        m.*,
        ct.phone_number,
        ct.name
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN contacts ct ON c.contact_id = ct.id
      WHERE m.content NOT LIKE '[BOTÃO]%'  
        AND m.content NOT LIKE '[LISTA]%'
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
