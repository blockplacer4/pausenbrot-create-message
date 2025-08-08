const sdk = require('node-appwrite');

module.exports = async (req, res) => {
  const client = new sdk.Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new sdk.Databases(client);
  const DB_ID = process.env.DB_ID;
  const CHATS = process.env.CHATS_COLLECTION_ID;
  const MESSAGES = process.env.MESSAGES_COLLECTION_ID;

  try {
    const payload = JSON.parse(req.payload || '{}');
    const chatId = payload.chatId;
    const content = (payload.content || '').toString().trim();
    const senderId = req.variables.APPWRITE_FUNCTION_USER_ID;

    if (!chatId || !content) return res.json({ error: 'chatId and content required' }, 400);

    // Chat laden und Teilnehmer prüfen
    const chat = await databases.getDocument(DB_ID, CHATS, chatId);
    const participants = chat.participants || [];
    if (!participants.includes(senderId)) {
      return res.json({ error: 'not a participant' }, 403);
    }

    const otherId = participants.find((id) => id !== senderId) || senderId;

    const permissions = [
      sdk.Permission.read(sdk.Role.user(senderId)),
      sdk.Permission.read(sdk.Role.user(otherId)),
      sdk.Permission.write(sdk.Role.user(senderId)),
      sdk.Permission.write(sdk.Role.user(otherId)),
      sdk.Permission.update(sdk.Role.user(senderId)),
      sdk.Permission.update(sdk.Role.user(otherId)),
      sdk.Permission.delete(sdk.Role.user(senderId)),
      sdk.Permission.delete(sdk.Role.user(otherId)),
    ];

    const msg = await databases.createDocument(
      DB_ID,
      MESSAGES,
      sdk.ID.unique(),
      { chatId, senderId, content },
      permissions
    );

    await databases.updateDocument(DB_ID, CHATS, chatId, {
      lastMessage: content,
      updatedAt: new Date().toISOString(),
    });

    return res.json(msg, 200);
  } catch (err) {
    return res.json({ error: String(err) }, 500);
  }
};
