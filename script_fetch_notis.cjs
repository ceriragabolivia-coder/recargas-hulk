const fs = require('fs');
let src = fs.readFileSync('src/components/Landing.jsx', 'utf8');
src = src.replace(/\r\n/g, '\n');

const targetStr = `    const fetchNotis = async () => {
      const { data, error } = await supabase
        .from('notificaciones_usuarios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data) {
        setNotificaciones(data);
        setUnreadCount(data.filter(n => !n.leido).length);
      }
    };`;

const funcStr = `    const fetchNotis = async () => {
      const { data, error } = await supabase
        .from('notificaciones_usuarios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data) {
        setNotificaciones(data);
        const unreads = data.filter(n => !n.leido);
        setUnreadCount(unreads.length);
        
        if (unreads.length > 0) {
          const latestUnread = unreads[0];
          setActiveToast(latestUnread);
          setTimeout(() => setActiveToast(null), 8000);
          playNotificationSound();
          
          if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'granted') {
              new Notification(latestUnread.titulo || 'Notificación', { body: latestUnread.mensaje || '' });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission().then(perm => {
                if (perm === 'granted') {
                  new Notification(latestUnread.titulo || 'Notificación', { body: latestUnread.mensaje || '' });
                }
              });
            }
          }
        }
      }
    };`;

src = src.replace(targetStr, funcStr);

fs.writeFileSync('src/components/Landing.jsx', src);
