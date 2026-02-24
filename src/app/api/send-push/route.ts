import { NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Выносим заголовки в константу, чтобы использовать их в обеих функциях
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 1. ОБРАБОТЧИК ДЛЯ БРАУЗЕРА (Решает проблему 405 ошибки)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// 2. ОСНОВНОЙ ОБРАБОТЧИК
export async function POST(request: Request) {
  try {
    const { chatId, senderId, text } = await request.json();

    if (!chatId || !senderId) {
      return NextResponse.json({ error: 'Missing chatId or senderId' }, { status: 400, headers: corsHeaders });
    }

    await initAdmin();
    const db = getFirestore();
    const messaging = getMessaging();

    const chatDoc = await db.collection('chats').doc(chatId).get();
    const chatData = chatDoc.data();
    
    if (!chatData) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404, headers: corsHeaders });
    }

    const senderDoc = await db.collection('users').doc(senderId).get();
    const senderName = senderDoc.data()?.nickname || 'Кто-то';

    const isGroup = chatData.isGroup === true;
    let notificationTitle = isGroup ? (chatData.title || 'Беседа') : senderName;
    let notificationBody = text || '📷 Фотография';

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
      return NextResponse.json({ success: true, message: 'No tokens found' }, { headers: corsHeaders });
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        chatId: chatId,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
          icon: 'ic_launcher_round'
        }
      }
    });

    return NextResponse.json({ success: true, sentCount: response.successCount }, { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error('Push error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}