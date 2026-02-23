'use client';

import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
// Импортируем вашу функцию инициализации
import { initializeFirebase } from '@/firebase'; 
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import { useRouter } from 'next/navigation';




export const PushNotificationsHandler = () => {

      const router = useRouter();

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;

    // Вызываем вашу существующую функцию для получения SDK
    const { auth, firestore: db } = initializeFirebase();

    const registerPush = async () => {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== 'granted') return;

      await PushNotifications.register();
    };

    const addListeners = async () => {
      await PushNotifications.addListener('registration', (token) => {
        saveTokenToFirestore(token.value);
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('Registration error: ', err.error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ', notification);
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        const data = notification.notification.data;
        
        console.log('Action performed with data:', data);

        // Если в данных уведомления есть chatId, переходим на страницу сообщений
        if (data.chatId) {
          router.push(`/messages?id=${data.chatId}`);
        } else if (data.type === 'post') {
          router.push(`/feed?postId=${data.postId}`);
        }
      });
    };

    const saveTokenToFirestore = async (token: string) => {
      // Используем auth и db, полученные из initializeFirebase()
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              fcmTokens: arrayUnion(token)
            });
          } catch (e) {
            console.error('Error saving token:', e);
          }
        }
      });
    };

    registerPush();
    addListeners();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  return null;
};