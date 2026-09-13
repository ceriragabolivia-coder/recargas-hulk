const fs = require('fs');

let src = fs.readFileSync('src/components/GestionCupones.jsx', 'utf8');
src = src.replace(/\r\n/g, '\n');

const targetStr = `    }
  }

  if (!isAdmin) {
    return <div style={{ padding: '20px', color: 'red' }}>Acceso denegado</div>
  }`;

const funcStr = `    }
  }

  const handleAssignToAll = async () => {
    if (!window.confirm("¿Estás seguro de regalar este cupón a TODOS los usuarios? Esta acción no se puede deshacer y puede tomar algo de tiempo.")) return;
    
    setAssignData(prev => ({ ...prev, isAssigningAll: true, assignAllProgress: 'Obteniendo lista de usuarios...' }));
    
    try {
      const cuponObj = cupones.find(c => c.id === assignData.cupon_id);
      if (!cuponObj) throw new Error("Cupón no encontrado");

      let allUsers = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase.from('clientes').select('auth_user_id').not('auth_user_id', 'is', null).range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allUsers.push(...data);
        page++;
      }
      
      if (allUsers.length === 0) throw new Error("No se encontraron usuarios.");
      
      setAssignData(prev => ({ ...prev, assignAllProgress: 'Buscando usuarios que ya tienen el cupón...' }));
      const { data: existing } = await supabase.from('cupones_usuarios').select('usuario_id').eq('cupon_id', assignData.cupon_id);
      const existingSet = new Set((existing || []).map(e => e.usuario_id));
      
      const newUsers = allUsers.filter(u => !existingSet.has(u.auth_user_id));
      if (newUsers.length === 0) {
        setAlertModal({ type: 'success', message: "Todos los usuarios ya tienen este cupón asignado." });
        setShowAssignModal(false);
        setAssignData(prev => ({ ...prev, isAssigningAll: false, assignAllProgress: '' }));
        return;
      }

      const chunkSize = 500;
      for (let i = 0; i < newUsers.length; i += chunkSize) {
        const chunk = newUsers.slice(i, i + chunkSize);
        setAssignData(prev => ({ ...prev, assignAllProgress: 'Asignando a usuarios ' + (i + 1) + ' - ' + Math.min(i + chunkSize, newUsers.length) + ' de ' + newUsers.length + '...' }));
        
        const inserts = chunk.map(u => ({ cupon_id: assignData.cupon_id, usuario_id: u.auth_user_id, usos: 0 }));
        await supabase.from('cupones_usuarios').upsert(inserts, { onConflict: 'cupon_id,usuario_id', ignoreDuplicates: true });
        
        const notifs = chunk.map(u => ({
          user_id: u.auth_user_id,
          titulo: '¡Te han regalado un cupón! 🎁',
          mensaje: 'Has recibido un cupón de ' + cuponObj.porcentaje_descuento + '% de descuento. Usa el código: ' + cuponObj.codigo + ' en tu próxima compra.'
        }));
        await supabase.from('notificaciones_usuarios').insert(notifs);
      }

      setAlertModal({ type: 'success', message: 'Cupón asignado exitosamente a ' + newUsers.length + ' usuarios nuevos.' });
      setShowAssignModal(false);
      setAssignData({ cupon_id: null, searchEmail: '', searchResults: [], isSearching: false, selectedUser: null, isAssigningAll: false, assignAllProgress: '' });
    } catch (err) {
      setAlertModal({ type: 'error', message: "Error al asignar: " + err.message });
      setAssignData(prev => ({ ...prev, isAssigningAll: false, assignAllProgress: '' }));
    }
  }

  if (!isAdmin) {
    return <div style={{ padding: '20px', color: 'red' }}>Acceso denegado</div>
  }`;

src = src.replace(targetStr, funcStr);

fs.writeFileSync('src/components/GestionCupones.jsx', src);
