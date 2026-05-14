const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'Layout.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix duplicates
content = content.replace(/  const { user, perfil, logout } = useAuth\(\)\n  const { config } = useConfiguracion\(\)\n\n  \/\/ Notificaciones en Vivo \(Toasts\)/, "\n  // Notificaciones en Vivo (Toasts)");

// Add sound toggle state and logic
if (!content.includes('soundEnabled')) {
  content = content.replace(
    /const { config } = useConfiguracion\(\)/,
    "const { config } = useConfiguracion()\n  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('admin_sound_enabled') !== 'false')\n\n  const toggleSound = () => {\n    const newVal = !soundEnabled;\n    setSoundEnabled(newVal);\n    localStorage.setItem('admin_sound_enabled', newVal.toString());\n  }"
  );
}

// Add check to playBellSound
if (!content.includes('if (!soundEnabled) return;')) {
  content = content.replace(
    /const playBellSound = \(\) => {/,
    "const playBellSound = () => {\n    if (!soundEnabled) return;"
  );
}

// Add check to playNotificationSound
if (!content.includes("if (localStorage.getItem('admin_sound_enabled') === 'false') return;")) {
  content = content.replace(
    /const playNotificationSound = \(\) => {/,
    "const playNotificationSound = () => {\n  if (localStorage.getItem('admin_sound_enabled') === 'false') return;"
  );
}

// Add toggle button to header
if (!content.includes('sound-toggle-btn')) {
  content = content.replace(
    /<WalletWidget onNavigate={handleMobileNavigate} \/>/,
    `<WalletWidget onNavigate={handleMobileNavigate} />
            {(isAdmin || isEmpleado || isNegocio) && (
              <button 
                onClick={toggleSound}
                className="sound-toggle-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 14px', borderRadius: '14px',
                  backgroundColor: soundEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: \`1px solid \${soundEnabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}\`,
                  color: soundEnabled ? '#22c55e' : '#ef4444',
                  cursor: 'pointer', transition: 'all 0.3s ease',
                  fontSize: '11px', fontWeight: 900,
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}
              >
                <span>{soundEnabled ? '🔊' : '🔇'}</span>
                <span className="desktop-only">{soundEnabled ? 'Efectos Activos' : 'Silencio'}</span>
              </button>
            )}`
  );
}

fs.writeFileSync(filePath, content);
console.log("Layout.jsx fixed successfully.");
