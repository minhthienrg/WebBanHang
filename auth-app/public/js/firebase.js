// Khởi tạo Firebase dùng chung cho mọi module.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export const app = initializeApp(firebaseConfig);

// Trong iframe bên thứ ba, có trình duyệt chặn IndexedDB/localStorage.
// Thử lần lượt từng kiểu lưu phiên, cuối cùng là bộ nhớ tạm (mất khi tải lại trang).
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
});
auth.languageCode = 'vi';

export const db = getFirestore(app);

// Chạy ở máy (firebase emulators:start) thì dùng Auth/Firestore giả lập, không đụng dữ liệu thật.
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
