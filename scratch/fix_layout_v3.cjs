const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'Layout.jsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// The duplicates are at 345 and 346 (1-indexed)
// So indices 344 and 345
console.log("Line 345:", lines[344]);
console.log("Line 346:", lines[345]);

if (lines[344].includes('useAuth') && lines[345].includes('useConfiguracion')) {
    console.log("Removing duplicate hooks at lines 345-346...");
    lines.splice(344, 2);
}

// Add sound state after the first set of hooks (which were at 331-332, now at same place)
// Let's find them
let hookIndex = lines.findIndex(l => l.includes('const { user, perfil, logout } = useAuth()'));
if (hookIndex !== -1) {
    console.log("Adding sound state after line", hookIndex + 1);
    lines.splice(hookIndex + 2, 0, 
        "  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('admin_sound_enabled') !== 'false')",
        "",
        "  const toggleSound = () => {",
        "    const newVal = !soundEnabled;",
        "    setSoundEnabled(newVal);",
        "    localStorage.setItem('admin_sound_enabled', newVal.toString());",
        "  }"
    );
}

let bellIndex = lines.findIndex(l => l.includes('const playBellSound = () => {'));
if (bellIndex !== -1) {
    lines.splice(bellIndex + 1, 0, "    if (!soundEnabled) return;");
}

let notiIndex = lines.findIndex(l => l.includes('const playNotificationSound = () => {'));
if (notiIndex !== -1) {
    lines.splice(notiIndex + 1, 0, "  if (localStorage.getItem('admin_sound_enabled') === 'false') return;");
}

let walletIndex = lines.findIndex(l => l.includes('<WalletWidget onNavigate={handleMobileNavigate} />'));
if (walletIndex !== -1) {
    lines.splice(walletIndex + 1, 0, 
        "            {(isAdmin || isEmpleado || isNegocio) && (",
        "              <button ",
        "                onClick={toggleSound}",
        "                className=\"sound-toggle-btn\"",
        "                style={{",
        "                  display: 'flex', alignItems: 'center', gap: '8px',",
        "                  padding: '6px 14px', borderRadius: '14px',",
        "                  backgroundColor: soundEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',",
        "                  border: `1px solid ${soundEnabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,",
        "                  color: soundEnabled ? '#22c55e' : '#ef4444',",
        "                  cursor: 'pointer', transition: 'all 0.3s ease',",
        "                  fontSize: '11px', fontWeight: 900,",
        "                  textTransform: 'uppercase', letterSpacing: '0.05em'",
        "                }}",
        "              >",
        "                <span>{soundEnabled ? '🔊' : '🔇'}</span>",
        "                <span className=\"desktop-only\">{soundEnabled ? 'Efectos Activos' : 'Silencio'}</span>",
        "              </button>",
        "            )}"
    );
}

fs.writeFileSync(filePath, lines.join('\n'));
console.log("Layout.jsx fully fixed.");
