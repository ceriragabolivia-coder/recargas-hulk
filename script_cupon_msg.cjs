const fs = require('fs');

let src = fs.readFileSync('src/components/GestionCupones.jsx', 'utf8');

const targetSubmit = `  const handleAssignSubmit = async (e) => {
    e.preventDefault()
    if (!assignData.cupon_id || !assignData.selectedUser) {
      setAlertModal({ type: 'warning', message: "Selecciona un cupón y un usuario" })
      return
    }

    const { data, error } = await supabase.rpc('asignar_cupon_usuario_rpc', {
      p_cupon_id: assignData.cupon_id,
      p_usuario_id: assignData.selectedUser.auth_user_id
    })

    if (error) {
      setAlertModal({ type: 'error', message: "Error al asignar: " + error.message })
    } else if (data && !data.success) {
      setAlertModal({ type: 'warning', message: data.message })
    } else {
      setAlertModal({ type: 'success', message: "Cupón asignado y notificado exitosamente al usuario" })
      setShowAssignModal(false)
      setAssignData({ cupon_id: null, searchEmail: '', searchResults: [], isSearching: false, selectedUser: null })
    }
  }`;

const replaceSubmit = `  const handleAssignSubmit = async (e) => {
    e.preventDefault()
    if (!assignData.cupon_id || !assignData.selectedUser) {
      setAlertModal({ type: 'warning', message: "Selecciona un cupón y un usuario" })
      return
    }

    const cuponObj = cupones.find(c => c.id === assignData.cupon_id);
    const fechaExp = cuponObj && cuponObj.fecha_fin ? new Date(cuponObj.fecha_fin).toLocaleDateString() : 'Sin caducidad';

    const { error: err1 } = await supabase.from('cupones_usuarios').upsert({
      cupon_id: assignData.cupon_id,
      usuario_id: assignData.selectedUser.auth_user_id,
      usos: 0
    }, { onConflict: 'cupon_id,usuario_id', ignoreDuplicates: true });

    if (err1) {
      setAlertModal({ type: 'error', message: "Error al asignar: " + err1.message })
      return
    }

    await supabase.from('notificaciones_usuarios').insert({
      user_id: assignData.selectedUser.auth_user_id,
      titulo: '¡Te han regalado un cupón! 🎁',
      mensaje: \`Has recibido un cupón de \${cuponObj.porcentaje_descuento}% de descuento. Usa el código: \${cuponObj.codigo} en tu próxima compra. Válido hasta: \${fechaExp}\`
    });

    setAlertModal({ type: 'success', message: "Cupón asignado y notificado exitosamente al usuario" })
    setShowAssignModal(false)
    setAssignData({ cupon_id: null, searchEmail: '', searchResults: [], isSearching: false, selectedUser: null, isAssigningAll: false, assignAllProgress: '' })
  }`;

src = src.replace(targetSubmit, replaceSubmit);

const targetAll = `          const notifs = chunk.map(u => ({
            user_id: u.auth_user_id,
            titulo: '¡Te han regalado un cupón! 🎁',
            mensaje: 'Has recibido un cupón de ' + cuponObj.porcentaje_descuento + '% de descuento. Usa el código: ' + cuponObj.codigo + ' en tu próxima compra.'
          }));`;

const replaceAll = `          const fechaExp = cuponObj.fecha_fin ? new Date(cuponObj.fecha_fin).toLocaleDateString() : 'Sin caducidad';
          const notifs = chunk.map(u => ({
            user_id: u.auth_user_id,
            titulo: '¡Te han regalado un cupón! 🎁',
            mensaje: 'Has recibido un cupón de ' + cuponObj.porcentaje_descuento + '% de descuento. Usa el código: ' + cuponObj.codigo + ' en tu próxima compra. Válido hasta: ' + fechaExp
          }));`;

src = src.replace(targetAll, replaceAll);

fs.writeFileSync('src/components/GestionCupones.jsx', src);
