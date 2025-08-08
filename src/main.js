import { Client, Databases, ID, Permission, Role } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const DB_ID = process.env.DB_ID;
  const CHATS = process.env.CHATS_COLLECTION_ID;
  const MESSAGES = process.env.MESSAGES_COLLECTION_ID;

  try {
    const body = typeof req.body === 'string' ? req.body : (req.payload || '{}');
    const payload = JSON.parse(body || '{}');

    const chatId = payload.chatId;
    const content = (payload.content || '').toString().trim();
    const senderId = req.variables?.APPWRITE_FUNCTION_USER_ID;

    if (!chatId || !content || !senderId) {
      return res.json({ error: 'chatId/content/senderId missing' }, 400);
    }

    const chat = await databases.getDocument(DB_ID, CHATS, chatId);
    const participants = chat.participants || [];
    if (!participants.includes(senderId)) {
      return res.json({ error: 'not a participant' }, 403);
    }
    const otherId = participants.find((id) => id !== senderId) || senderId;

    const permissions = [
      Permission.read(Role.user(senderId)),
      Permission.read(Role.user(otherId)),
      Permission.write(Role.user(senderId)),
      Permission.write(Role.user(otherId)),
      Permission.update(Role.user(senderId)),
      Permission.update(Role.user(otherId)),
      Permission.delete(Role.user(senderId)),
      Permission.delete(Role.user(otherId)),
    ];

    const msg = await databases.createDocument(
      DB_ID,
      MESSAGES,
      ID.unique(),
      { chatId, senderId, content },
      permissions
    );

    await databases.updateDocument(DB_ID, CHATS, chatId, {
      lastMessage: content,
      updatedAt: new Date().toISOString(),
    });

    return res.json(msg, 200);
  } catch (e) {
    error(String(e));
    return res.json({ error: String(e) }, 500);
  }
};
