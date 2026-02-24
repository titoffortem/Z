import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export async function POST(request: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return NextResponse.json({}, { headers });
  }

  try {
    const { chatId, senderId, text } = await request.json();

    if (!chatId || !senderId) {
      return NextResponse.json({ error: 'Missing chatId or senderId' }, { status: 400, headers });
    }

    await initAdmin();
    const db = getFirestore();
    const messaging = getMessaging();

    const chatDoc = await db.collection('chats').doc(chatId).get();
    const chatData = chatDoc.data();
    if (!chatData) return NextResponse.json({ error: 'Chat not found' }, { status: 404, headers });

    const senderDoc = await db.collection('users').doc(senderId).get();
    const senderName = senderDoc.data()?.nickname || 'Кто-то';

    const isGroup = chatData.isGroup === true;
    
    // ЛОГИКА ТЕКСТА: Только то, что отправили прямо сейчас
    let notificationTitle = isGroup ? (chatData.title || 'Беседа') : senderName;
    let notificationBody = text || '📷 Фотография';

    // Для группы добавляем имя отправителя в тело сообщения
    if (isGroup) {
      notificationBody = `${senderName}: ${notificationBody}`;
    }

    const recipientIds = (chatData.participantIds as string[] || []).filter(uid => uid !== senderId);

    const tokens: string[] = [];
    for (const uid of recipientIds) {
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data();
      if (userData?.fcmTokens && Array.isArray(userData.fcmTokens)) {
        tokens.push(...userData.fcmTokens);
      }
    }

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, message: 'No tokens found' }, { headers });
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        chatId: chatId,
        click_action: "FLUTTER_NOTIFICATION_CLICK", // Стандартный клик
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
          // ВАЖНО: Никакого tag. Пусть Android сам стакает (группирует) уведомления.
          icon: 'ic_stat_icon'
        }
      }
    });

    return NextResponse.json({ success: true, sentCount: response.successCount }, { status: 200, headers });

  } catch (error: any) {
    console.error('Push error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers });
  }
}