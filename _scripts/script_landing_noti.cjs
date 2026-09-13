const fs = require('fs');
let src = fs.readFileSync('src/components/Landing.jsx', 'utf8');

const targetNoti = `          setNotificaciones(prev => [payload.new, ...prev].slice(0, 10));
          setUnreadCount(count => count + 1);
          setActiveToast(payload.new);
          setTimeout(() => setActiveToast(null), 8000);
          playNotificationSound();`;

const replaceNoti = `          setNotificaciones(prev => [payload.new, ...prev].slice(0, 10));
          setUnreadCount(count => count + 1);
          setActiveToast(payload.new);
          setTimeout(() => setActiveToast(null), 8000);
          playNotificationSound();
          if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'granted') {
              new Notification(payload.new.titulo || 'Notificación', { body: payload.new.mensaje || '' });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission().then(perm => {
                if (perm === 'granted') {
                  new Notification(payload.new.titulo || 'Notificación', { body: payload.new.mensaje || '' });
                }
              });
            }
          }`;

src = src.replace(targetNoti, replaceNoti);

fs.writeFileSync('src/components/Landing.jsx', src);
