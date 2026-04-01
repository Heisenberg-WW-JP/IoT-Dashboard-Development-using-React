import { useState, useEffect, useContext, createContext, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
//  1. CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PERMISSIONS = {
  VIEW_DASHBOARD:   "view_dashboard",
  CONTROL_RELAY:    "control_relay",
  VIEW_ANALYTICS:   "view_analytics",
  MANAGE_USERS:     "manage_users",
  VIEW_ALL_DEVICES: "view_all_devices",
};

const ROLES = {
  ADMIN: {
    id: "admin", label: "Admin", color: "#f6ad55", bg: "rgba(246,173,85,0.12)",
    permissions: Object.values(PERMISSIONS),
  },
  OPERATOR: {
    id: "operator", label: "Operator", color: "#63b3ed", bg: "rgba(99,179,237,0.12)",
    permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.CONTROL_RELAY, PERMISSIONS.VIEW_ANALYTICS, PERMISSIONS.VIEW_ALL_DEVICES],
  },
  VIEWER: {
    id: "viewer", label: "Viewer", color: "#68d391", bg: "rgba(104,211,145,0.12)",
    permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_ANALYTICS],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. MOCK DATABASE
// ─────────────────────────────────────────────────────────────────────────────

const DB = {
  users: [
    { id: "u1", name: "Arjun Sharma",  email: "admin@anedya.io",    password: "admin123",    role: "admin",    active: true,  avatar: "AS", createdAt: "2024-01-10" },
    { id: "u2", name: "Priya Menon",   email: "operator@anedya.io", password: "operator123", role: "operator", active: true,  avatar: "PM", createdAt: "2024-02-15" },
    { id: "u3", name: "Rahul Verma",   email: "viewer@anedya.io",   password: "viewer123",   role: "viewer",   active: true,  avatar: "RV", createdAt: "2024-03-01" },
    { id: "u4", name: "Sneha Patil",   email: "sneha@anedya.io",    password: "sneha123",    role: "operator", active: false, avatar: "SP", createdAt: "2024-03-20" },
  ],
  devices: [
    { id: "node-001", name: "Living Room", type: "Climate", online: true,  relay: true,  temp: 24.3, humidity: 58, battery: 87, location: "Floor 1" },
    { id: "node-002", name: "Server Room", type: "Climate", online: true,  relay: false, temp: 31.7, humidity: 42, battery: 62, location: "Floor 2" },
    { id: "node-003", name: "Greenhouse",  type: "Climate", online: false, relay: false, temp: 28.1, humidity: 75, battery: 15, location: "Rooftop" },
    { id: "node-004", name: "Warehouse",   type: "Climate", online: true,  relay: true,  temp: 19.8, humidity: 65, battery: 94, location: "Building B" },
  ],
  sessions: {},
};

// ─────────────────────────────────────────────────────────────────────────────
//  3. HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function generateHistory(baseTemp, baseHumidity, points = 24) {
  return Array.from({ length: points }, (_, i) => ({
    time: `${String(i).padStart(2, "0")}:00`,
    temperature: +(baseTemp + Math.sin(i / 4) * 2 + (Math.random() - 0.5) * 1.5).toFixed(1),
    humidity: +(baseHumidity + Math.cos(i / 5) * 5 + (Math.random() - 0.5) * 3).toFixed(1),
  }));
}

function requireAuth(token) {
  const session = DB.sessions[token];
  if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized. Please login again.");
  const user = DB.users.find(u => u.id === session.userId);
  if (!user) throw new Error("Unauthorized.");
  const { password: _, ...safe } = user;
  return safe;
}

function requirePermission(token, permission) {
  const user = requireAuth(token);
  const role = ROLES[user.role.toUpperCase()];
  if (!role?.permissions.includes(permission)) throw new Error("Forbidden: Insufficient permissions.");
}

function hasPermission(user, permission) {
  if (!user) return false;
  const role = ROLES[user.role.toUpperCase()];
  return role?.permissions.includes(permission) ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. SERVICES
// ─────────────────────────────────────────────────────────────────────────────

const AuthService = {
  login: async (email, password) => {
    await delay(600);
    const user = DB.users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error("Invalid email or password.");
    if (!user.active) throw new Error("Account is deactivated. Contact your administrator.");
    const token = `tok_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    DB.sessions[token] = { userId: user.id, token, expiresAt: Date.now() + 3600000 };
    const { password: _, ...safeUser } = user;
    return { user: safeUser, token };
  },
  logout: async (token) => { await delay(200); delete DB.sessions[token]; },
  validateToken: (token) => {
    const session = DB.sessions[token];
    if (!session || session.expiresAt < Date.now()) return null;
    const user = DB.users.find(u => u.id === session.userId);
    if (!user) return null;
    const { password: _, ...safe } = user;
    return safe;
  },
};

const UserService = {
  getAll: async (token) => {
    await delay(300);
    requireAuth(token);
    return DB.users.map(({ password: _, ...u }) => u);
  },
  create: async (token, data) => {
    await delay(500);
    requireAuth(token);
    requirePermission(token, PERMISSIONS.MANAGE_USERS);
    if (DB.users.find(u => u.email === data.email)) throw new Error("Email already exists.");
    const newUser = {
      id: `u${DB.users.length + 1}`,
      avatar: data.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
      createdAt: new Date().toISOString().split("T")[0],
      active: true,
      ...data,
    };
    DB.users.push(newUser);
    const { password: _, ...safe } = newUser;
    return safe;
  },
  update: async (token, id, data) => {
    await delay(400);
    requireAuth(token);
    requirePermission(token, PERMISSIONS.MANAGE_USERS);
    const idx = DB.users.findIndex(u => u.id === id);
    if (idx < 0) throw new Error("User not found.");
    DB.users[idx] = { ...DB.users[idx], ...data };
    const { password: _, ...safe } = DB.users[idx];
    return safe;
  },
  deactivate: async (token, id) => {
    await delay(400);
    requireAuth(token);
    requirePermission(token, PERMISSIONS.MANAGE_USERS);
    const user = DB.users.find(u => u.id === id);
    if (!user) throw new Error("User not found.");
    user.active = false;
    return true;
  },
};

const DeviceService = {
  getAll: async (token) => {
    await delay(300);
    requireAuth(token);
    return DB.devices.map(d => ({ ...d }));
  },
  toggleRelay: async (token, deviceId) => {
    await delay(350);
    requireAuth(token);
    requirePermission(token, PERMISSIONS.CONTROL_RELAY);
    const device = DB.devices.find(d => d.id === deviceId);
    if (!device) throw new Error("Device not found.");
    if (!device.online) throw new Error("Cannot control an offline device.");
    device.relay = !device.relay;
    return { ...device };
  },
  getHistory: async (token, deviceId) => {
    await delay(400);
    requireAuth(token);
    requirePermission(token, PERMISSIONS.VIEW_ANALYTICS);
    const device = DB.devices.find(d => d.id === deviceId);
    if (!device) throw new Error("Device not found.");
    return generateHistory(device.temp, device.humidity);
  },
  liveUpdate: () => {
    DB.devices.forEach(d => {
      if (d.online) {
        d.temp = +(d.temp + (Math.random() - 0.5) * 0.8).toFixed(1);
        d.humidity = Math.max(20, Math.min(95, +(d.humidity + (Math.random() - 0.5) * 1.5).toFixed(1)));
      }
    });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  5. AUTH CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = sessionStorage.getItem("anedya_token");
    if (saved) {
      const u = AuthService.validateToken(saved);
      if (u) { setUser(u); setToken(saved); }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await AuthService.login(email, password);
    setUser(res.user);
    setToken(res.token);
    sessionStorage.setItem("anedya_token", res.token);
    return res;
  };

  const logout = async () => {
    if (token) await AuthService.logout(token);
    setUser(null);
    setToken(null);
    sessionStorage.removeItem("anedya_token");
  };

  const can = (permission) => hasPermission(user, permission);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, can, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

// ─────────────────────────────────────────────────────────────────────────────
//  6. DESIGN TOKENS & GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────

const G = {
  bg0: "#05080f",
  bg1: "#0a0f1e",
  bg2: "#0f1628",
  surface: "rgba(255,255,255,0.03)",
  surfaceHover: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.13)",
  accent: "#4fc3f7",
  accentGlow: "rgba(79,195,247,0.2)",
  amber: "#fbbf24",
  green: "#34d399",
  red: "#f87171",
  purple: "#a78bfa",
  text0: "#f1f5f9",
  text1: "#94a3b8",
  text2: "#475569",
  radius: 14,
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'Sora', 'DM Sans', sans-serif",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${G.bg0}; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.09); border-radius: 4px; }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
  @keyframes spin    { to { transform: rotate(360deg); } }
  .fade-up { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
  .fade-in { animation: fadeIn 0.3s ease both; }
`;

// ─────────────────────────────────────────────────────────────────────────────
//  7. SHARED UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

const Card = ({ children, style }) => (
  <div style={{
    background: G.surface,
    border: `1px solid ${G.border}`,
    borderRadius: G.radius,
    ...style,
  }}>{children}</div>
);

const Badge = ({ children, color, style }) => {
  const c = color || G.accent;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
      background: c + "18", color: c, border: `1px solid ${c}30`,
      fontFamily: G.sans, letterSpacing: "0.04em", ...style,
    }}>{children}</span>
  );
};

const Btn = ({ children, onClick, variant, disabled, loading: ld, small, style }) => {
  const v = variant || "default";
  const map = {
    primary: { background: `linear-gradient(135deg, ${G.accent}, #29b6f6)`, color: "#020810", border: "none" },
    danger:  { background: "rgba(248,113,113,0.12)", color: G.red,   border: `1px solid rgba(248,113,113,0.3)` },
    ghost:   { background: "transparent",            color: G.text1, border: `1px solid ${G.border}` },
    success: { background: "rgba(52,211,153,0.12)",  color: G.green, border: `1px solid rgba(52,211,153,0.3)` },
    default: { background: G.surface,                color: G.text0, border: `1px solid ${G.border}` },
  };
  return (
    <button onClick={onClick} disabled={disabled || ld} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
      padding: small ? "6px 14px" : "9px 20px",
      borderRadius: 9, fontSize: small ? 12 : 13, fontWeight: 600,
      fontFamily: G.sans, cursor: disabled || ld ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1, transition: "all 0.18s ease",
      ...map[v], ...style,
    }}>
      {ld
        ? <span style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
        : children}
    </button>
  );
};

const Input = ({ label, type, value, onChange, placeholder, error, icon }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: G.text1, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>}
    <div style={{ position: "relative" }}>
      {icon && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: G.text2, display: "flex" }}>{icon}</span>}
      <input
        type={type || "text"} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: icon ? "11px 14px 11px 38px" : "11px 14px",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${error ? G.red + "80" : G.border}`,
          borderRadius: 9, color: G.text0, fontSize: 14, fontFamily: G.sans, outline: "none",
        }}
        onFocus={e => e.target.style.borderColor = G.accent + "80"}
        onBlur={e => e.target.style.borderColor = error ? G.red + "80" : G.border}
      />
    </div>
    {error && <span style={{ fontSize: 11, color: G.red }}>{error}</span>}
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: G.text1, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      padding: "11px 14px", background: "rgba(255,255,255,0.04)",
      border: `1px solid ${G.border}`, borderRadius: 9, color: G.text0,
      fontSize: 14, fontFamily: G.sans, cursor: "pointer", outline: "none",
    }}>
      {options.map(o => <option key={o.value} value={o.value} style={{ background: G.bg2 }}>{o.label}</option>)}
    </select>
  </div>
);

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: G.green, error: G.red, info: G.accent, warning: G.amber };
  const c = colors[type] || G.accent;
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: G.bg2, border: `1px solid ${c}40`, borderLeft: `3px solid ${c}`,
      borderRadius: 10, padding: "14px 18px", minWidth: 280,
      display: "flex", alignItems: "center", gap: 12,
      animation: "fadeUp 0.3s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      <span style={{ fontSize: 18 }}>{{ success: "✓", error: "✕", info: "ℹ", warning: "⚠" }[type] || "●"}</span>
      <span style={{ fontSize: 13, color: G.text0, fontFamily: G.sans, flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: G.text2, cursor: "pointer", fontSize: 18 }}>×</button>
    </div>
  );
}

function Modal({ title, children, onClose, width }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease",
    }}>
      <div style={{
        background: G.bg2, border: `1px solid ${G.borderStrong}`,
        borderRadius: 18, padding: "28px 32px", width: width || 480, maxWidth: "95vw",
        animation: "fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: G.text0, fontFamily: G.sans }}>{title}</h3>
          <button onClick={onClose} style={{ background: G.surface, border: `1px solid ${G.border}`, color: G.text1, width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Spinner = ({ size, color }) => (
  <div style={{
    width: size || 24, height: size || 24,
    border: `2px solid ${(color || G.accent)}30`,
    borderTop: `2px solid ${color || G.accent}`,
    borderRadius: "50%", animation: "spin 0.7s linear infinite",
  }} />
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(5,8,15,0.97)", border: `1px solid ${G.border}`, borderRadius: 10, padding: "10px 16px", fontSize: 12, fontFamily: G.sans }}>
      <p style={{ color: G.accent, marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: <strong style={{ fontFamily: G.mono }}>{p.value}{p.name === "Temperature" ? "°C" : "%"}</strong>
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  8. ICONS
// ─────────────────────────────────────────────────────────────────────────────

const Ico = {
  Logo:     () => <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Dashboard:() => <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={2}/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={2}/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={2}/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={2}/></svg>,
  Analytics:() => <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Devices:  () => <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth={2}/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>,
  Users:    () => <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth={2}/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>,
  Temp:     () => <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Humidity: () => <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Power:    () => <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>,
  Wifi:     () => <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>,
  WifiOff:  () => <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a11 11 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>,
  Alert:    () => <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>,
  Plus:     () => <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>,
  Edit:     () => <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Lock:     () => <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth={2}/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>,
  Mail:     () => <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth={2}/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth={2}/></svg>,
  Logout:   () => <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Shield:   () => <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Refresh:  () => <svg viewBox="0 0 24 24" fill="none" width={15} height={15}><polyline points="23 4 23 10 17 10" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/><polyline points="1 20 1 14 7 14" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>,
  Battery:  () => <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><rect x="2" y="7" width="18" height="11" rx="2" stroke="currentColor" strokeWidth={2}/><line x1="22" y1="11" x2="22" y2="13" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>,
};

// ─────────────────────────────────────────────────────────────────────────────
//  9. LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const demoAccounts = [
    { label: "Admin",    email: "admin@anedya.io",    password: "admin123",    role: ROLES.ADMIN },
    { label: "Operator", email: "operator@anedya.io", password: "operator123", role: ROLES.OPERATOR },
    { label: "Viewer",   email: "viewer@anedya.io",   password: "viewer123",   role: ROLES.VIEWER },
  ];

  const handleLogin = async (ev, overrideEmail, overridePass) => {
    if (ev && ev.preventDefault) ev.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(overrideEmail || email, overridePass || password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: G.bg0, fontFamily: G.sans, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${G.border} 1px, transparent 1px), linear-gradient(90deg, ${G.border} 1px, transparent 1px)`, backgroundSize: "48px 48px", opacity: 0.4 }} />
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: 700, height: 700, background: `radial-gradient(circle, ${G.accentGlow} 0%, transparent 55%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: 500, height: 500, background: "radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 55%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440, padding: "0 20px" }}>
        <div className="fade-up" style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, background: `linear-gradient(135deg, ${G.accent}, #29b6f6)`, borderRadius: 16, marginBottom: 16, boxShadow: `0 0 32px ${G.accentGlow}` }}>
            <span style={{ color: "#020810" }}><Ico.Logo /></span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: G.text0, letterSpacing: "-0.03em" }}>Anedya IoT</h1>
          <p style={{ fontSize: 14, color: G.text2, marginTop: 4 }}>Secure access to your IoT dashboard</p>
        </div>

        <Card className="fade-up" style={{ padding: "32px 36px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Input label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@anedya.io" icon={<Ico.Mail />} />
            <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" icon={<Ico.Lock />} />
            {error && (
              <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: G.red, display: "flex", alignItems: "center", gap: 8 }}>
                <Ico.Alert /> {error}
              </div>
            )}
            <Btn variant="primary" onClick={handleLogin} loading={loading} style={{ width: "100%", padding: "13px", fontSize: 15, marginTop: 4 }}>
              Sign In
            </Btn>
          </div>
        </Card>

        <div className="fade-up" style={{ marginTop: 20 }}>
          <p style={{ fontSize: 11, color: G.text2, textAlign: "center", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Demo Accounts</p>
          <div style={{ display: "flex", gap: 10 }}>
            {demoAccounts.map(acc => (
              <button key={acc.label} onClick={() => handleLogin(null, acc.email, acc.password)} style={{
                flex: 1, padding: "10px 8px", borderRadius: 10,
                background: acc.role.bg, border: `1px solid ${acc.role.color}30`,
                color: acc.role.color, fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: G.sans, transition: "all 0.2s",
              }}>
                {acc.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: G.text2, textAlign: "center", marginTop: 10 }}>Click any role to sign in instantly</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  10. SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────

function Sidebar({ activePage, setActivePage }) {
  const { user, logout, can } = useAuth();
  const role = ROLES[user?.role?.toUpperCase()];

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Ico.Dashboard, perm: PERMISSIONS.VIEW_DASHBOARD },
    { id: "analytics", label: "Analytics",  icon: Ico.Analytics,  perm: PERMISSIONS.VIEW_ANALYTICS },
    { id: "devices",   label: "Devices",    icon: Ico.Devices,    perm: PERMISSIONS.VIEW_DASHBOARD },
    { id: "users",     label: "Users",      icon: Ico.Users,      perm: PERMISSIONS.MANAGE_USERS },
  ].filter(item => can(item.perm));

  return (
    <div style={{ width: 240, minHeight: "100vh", background: G.bg1, borderRight: `1px solid ${G.border}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, fontFamily: G.sans }}>
      <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${G.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${G.accent}, #29b6f6)`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#020810" }}><Ico.Logo /></span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: G.text0 }}>Anedya IoT</p>
            <p style={{ fontSize: 10, color: G.text2, letterSpacing: "0.05em" }}>DASHBOARD</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 22px", borderBottom: `1px solid ${G.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${role?.color}28`, border: `1px solid ${role?.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: role?.color }}>
            {user?.avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: G.text0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</p>
            <Badge color={role?.color} style={{ fontSize: 10, padding: "1px 7px" }}><Ico.Shield /> {role?.label}</Badge>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "14px 12px" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: G.text2, textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 10px", marginBottom: 8 }}>Navigation</p>
        {navItems.map(item => {
          const active = activePage === item.id;
          return (
            <button key={item.id} onClick={() => setActivePage(item.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 9, cursor: "pointer", marginBottom: 2,
              background: active ? `${G.accent}14` : "transparent",
              border: active ? `1px solid ${G.accent}25` : "1px solid transparent",
              color: active ? G.accent : G.text1,
              fontSize: 13, fontWeight: active ? 600 : 500,
              fontFamily: G.sans, transition: "all 0.18s", textAlign: "left",
            }}>
              <item.icon />
              {item.label}
              {active && <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: G.accent }} />}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "14px 12px", borderTop: `1px solid ${G.border}` }}>
        <button onClick={logout} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", borderRadius: 9, cursor: "pointer",
          background: "transparent", border: "1px solid transparent",
          color: G.text2, fontSize: 13, fontWeight: 500, fontFamily: G.sans,
          transition: "all 0.18s", textAlign: "left",
        }}
          onMouseEnter={e => { e.currentTarget.style.color = G.red; e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = G.text2; e.currentTarget.style.background = "transparent"; }}
        >
          <Ico.Logout /> Sign Out
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  11. DEVICE CARD
// ─────────────────────────────────────────────────────────────────────────────

function DeviceCard({ device, onToggleRelay, canControl, selected, onSelect }) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (!canControl || !device.online) return;
    setToggling(true);
    try { await onToggleRelay(device.id); }
    finally { setToggling(false); }
  };

  const tempColor = device.temp > 30 ? G.red : device.temp > 26 ? G.amber : G.green;

  return (
    <Card onClick={() => onSelect(device)} style={{
      padding: "18px 20px", cursor: "pointer",
      border: `1px solid ${selected ? G.accent + "50" : G.border}`,
      background: selected ? `${G.accent}08` : G.surface,
      transition: "all 0.2s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: G.text0 }}>{device.name}</p>
          <p style={{ fontSize: 11, color: G.text2, fontFamily: G.mono, marginTop: 2 }}>{device.id}</p>
        </div>
        <Badge color={device.online ? G.green : G.red}>
          {device.online ? <><Ico.Wifi /> Online</> : <><Ico.WifiOff /> Offline</>}
        </Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div style={{ background: `${tempColor}10`, border: `1px solid ${tempColor}20`, borderRadius: 10, padding: "10px 12px" }}>
          <p style={{ fontSize: 10, color: G.text2, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Temperature</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: tempColor, fontFamily: G.mono }}>{device.temp}°<span style={{ fontSize: 12 }}>C</span></p>
        </div>
        <div style={{ background: `${G.accent}0d`, border: `1px solid ${G.accent}20`, borderRadius: 10, padding: "10px 12px" }}>
          <p style={{ fontSize: 10, color: G.text2, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Humidity</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: G.accent, fontFamily: G.mono }}>{device.humidity}<span style={{ fontSize: 12 }}>%</span></p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Ico.Battery />
          <div style={{ width: 50, height: 5, background: G.border, borderRadius: 3 }}>
            <div style={{ width: `${device.battery}%`, height: "100%", borderRadius: 3, background: device.battery > 50 ? G.green : device.battery > 20 ? G.amber : G.red, transition: "width 0.5s" }} />
          </div>
          <span style={{ fontSize: 11, color: G.text2, fontFamily: G.mono }}>{device.battery}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: G.text2 }}>Relay</span>
          <button
            onClick={handleToggle}
            disabled={!canControl || !device.online || toggling}
            title={!canControl ? "No permission" : !device.online ? "Device offline" : "Toggle relay"}
            style={{
              width: 40, height: 22, borderRadius: 11,
              cursor: canControl && device.online ? "pointer" : "not-allowed",
              background: device.relay ? G.green : "rgba(255,255,255,0.1)",
              border: "none", position: "relative", transition: "background 0.25s",
              opacity: !canControl || !device.online ? 0.4 : 1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {toggling
              ? <Spinner size={12} color="#fff" />
              : <div style={{ position: "absolute", top: 2, left: device.relay ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.25s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
            }
          </button>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  12. STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, Icon: I, color, delta }) {
  return (
    <Card style={{ padding: "20px 22px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -10, right: -10, width: 80, height: 80, background: `radial-gradient(circle, ${color}18, transparent 65%)`, borderRadius: "50%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: G.text2, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
        <div style={{ color, opacity: 0.8 }}><I /></div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: G.text0, fontFamily: G.mono }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: G.text2 }}>{unit}</span>}
      </div>
      {delta && <p style={{ fontSize: 11, color: G.text2, marginTop: 4 }}>{delta}</p>}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  13. DASHBOARD PAGE
// ─────────────────────────────────────────────────────────────────────────────

function DashboardPage({ devices, onToggleRelay, onSelectDevice, selectedDevice }) {
  const { can } = useAuth();
  const online   = devices.filter(d => d.online).length;
  const avgTemp  = devices.length ? (devices.reduce((s, d) => s + d.temp, 0) / devices.length).toFixed(1) : "—";
  const avgHumid = devices.length ? (devices.reduce((s, d) => s + d.humidity, 0) / devices.length).toFixed(1) : "—";
  const relaysOn = devices.filter(d => d.relay).length;

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <StatCard label="Online Nodes"    value={online}   unit={`/ ${devices.length}`} Icon={Ico.Wifi}     color={G.green}  delta="Live status" />
        <StatCard label="Avg Temperature" value={avgTemp}  unit="°C"                    Icon={Ico.Temp}     color={G.amber}  delta="All nodes" />
        <StatCard label="Avg Humidity"    value={avgHumid} unit="%"                     Icon={Ico.Humidity} color={G.accent} delta="All nodes" />
        <StatCard label="Relays Active"   value={relaysOn} unit={`/ ${devices.length}`} Icon={Ico.Power}    color={G.purple} delta="Controllable" />
      </div>

      {devices.some(d => !d.online || d.battery < 20) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {devices.filter(d => !d.online).map(d => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: G.red, fontFamily: G.sans }}>
              <Ico.Alert /> <strong>{d.name}</strong> is offline — check connectivity
            </div>
          ))}
          {devices.filter(d => d.battery < 20).map(d => (
            <div key={"bat" + d.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: G.amber, fontFamily: G.sans }}>
              <Ico.Alert /> <strong>{d.name}</strong> battery critically low ({d.battery}%)
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: G.text2, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Device Nodes</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
          {devices.map(d => (
            <DeviceCard key={d.id} device={d} onToggleRelay={onToggleRelay}
              canControl={can(PERMISSIONS.CONTROL_RELAY)}
              selected={selectedDevice?.id === d.id}
              onSelect={onSelectDevice}
            />
          ))}
        </div>
      </div>

      {!can(PERMISSIONS.CONTROL_RELAY) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${G.purple}0d`, border: `1px solid ${G.purple}25`, borderRadius: 10, padding: "10px 16px", fontSize: 12, color: G.purple }}>
          <Ico.Shield /> Read-only access. Relay control requires Operator or Admin role.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  14. ANALYTICS PAGE
// ─────────────────────────────────────────────────────────────────────────────

function AnalyticsPage({ devices, token }) {
  const [historyMap, setHistoryMap] = useState({});
  const [selectedId, setSelectedId] = useState(devices[0]?.id || "");
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    if (!selectedId || historyMap[selectedId]) return;
    setLoading(true);
    DeviceService.getHistory(token, selectedId)
      .then(h => setHistoryMap(prev => ({ ...prev, [selectedId]: h })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedId, token]);

  const currentHistory = historyMap[selectedId] || [];
  const selectedName   = devices.find(d => d.id === selectedId)?.name || "";

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: G.text0, fontFamily: G.sans }}>Historical Analytics</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {devices.map(d => (
            <button key={d.id} onClick={() => setSelectedId(d.id)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: selectedId === d.id ? `${G.accent}18` : G.surface,
              border: `1px solid ${selectedId === d.id ? G.accent + "40" : G.border}`,
              color: selectedId === d.id ? G.accent : G.text1, fontFamily: G.sans, transition: "all 0.2s",
            }}>{d.name}</button>
          ))}
        </div>
      </div>

      {loading
        ? <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
        : <>
          <Card style={{ padding: "22px 24px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: G.text0, marginBottom: 18, fontFamily: G.sans }}>
              Temperature — 24h <span style={{ color: G.text2, fontWeight: 400, fontSize: 12 }}>({selectedName})</span>
            </p>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={currentHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={G.amber} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={G.amber} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={G.border} strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: G.text2, fontSize: 11 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fill: G.text2, fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto","auto"]} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="temperature" name="Temperature" stroke={G.amber} strokeWidth={2.5} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card style={{ padding: "22px 24px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: G.text0, marginBottom: 18, fontFamily: G.sans }}>
              Humidity — 24h <span style={{ color: G.text2, fontWeight: 400, fontSize: 12 }}>({selectedName})</span>
            </p>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={currentHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={G.accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={G.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={G.border} strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: G.text2, fontSize: 11 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fill: G.text2, fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto","auto"]} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="humidity" name="Humidity" stroke={G.accent} strokeWidth={2.5} fill="url(#g2)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card style={{ padding: "22px 24px" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: G.text0, marginBottom: 18, fontFamily: G.sans }}>Temp — All Nodes</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={devices} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={G.border} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: G.text2, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: G.text2, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="temp" name="Temperature" fill={G.amber} radius={[6,6,0,0]} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card style={{ padding: "22px 24px" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: G.text0, marginBottom: 18, fontFamily: G.sans }}>Humidity — All Nodes</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={devices} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={G.border} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: G.text2, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: G.text2, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="humidity" name="Humidity" fill={G.accent} radius={[6,6,0,0]} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  15. DEVICES PAGE
// ─────────────────────────────────────────────────────────────────────────────

function DevicesPage({ devices, onToggleRelay }) {
  const { can } = useAuth();
  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: G.text0, fontFamily: G.sans }}>All Devices</h2>
      <Card style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: G.sans }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${G.border}` }}>
              {["Node ID","Name","Location","Status","Temperature","Humidity","Battery","Relay"].map(h => (
                <th key={h} style={{ padding: "13px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: G.text2, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {devices.map((d, i) => (
              <tr key={d.id}
                style={{ borderBottom: i < devices.length - 1 ? `1px solid ${G.border}` : "none" }}
                onMouseEnter={e => e.currentTarget.style.background = G.surfaceHover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "13px 18px", fontFamily: G.mono, fontSize: 12, color: G.accent }}>{d.id}</td>
                <td style={{ padding: "13px 18px", fontSize: 13, fontWeight: 600, color: G.text0 }}>{d.name}</td>
                <td style={{ padding: "13px 18px", fontSize: 12, color: G.text2 }}>{d.location}</td>
                <td style={{ padding: "13px 18px" }}><Badge color={d.online ? G.green : G.red}>{d.online ? "Online" : "Offline"}</Badge></td>
                <td style={{ padding: "13px 18px", fontFamily: G.mono, fontSize: 14, fontWeight: 600, color: d.temp > 30 ? G.red : G.amber }}>{d.temp}°C</td>
                <td style={{ padding: "13px 18px", fontFamily: G.mono, fontSize: 14, fontWeight: 600, color: G.accent }}>{d.humidity}%</td>
                <td style={{ padding: "13px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 50, height: 5, background: G.border, borderRadius: 3 }}>
                      <div style={{ width: `${d.battery}%`, height: "100%", borderRadius: 3, background: d.battery > 50 ? G.green : d.battery > 20 ? G.amber : G.red }} />
                    </div>
                    <span style={{ fontFamily: G.mono, fontSize: 11, color: G.text2 }}>{d.battery}%</span>
                  </div>
                </td>
                <td style={{ padding: "13px 18px" }}>
                  {can(PERMISSIONS.CONTROL_RELAY)
                    ? <Btn small variant={d.relay ? "success" : "ghost"} onClick={() => onToggleRelay(d.id)} disabled={!d.online}>
                        <Ico.Power /> {d.relay ? "ON" : "OFF"}
                      </Btn>
                    : <Badge color={d.relay ? G.green : G.text2}>{d.relay ? "ON" : "OFF"}</Badge>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  16. USERS PAGE
// ─────────────────────────────────────────────────────────────────────────────

function UsersPage({ token, addToast }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState({});
  const [form, setForm]         = useState({ name: "", email: "", password: "", role: "viewer" });

  const loadUsers = useCallback(async () => {
    try {
      const data = await UserService.getAll(token);
      setUsers(data);
    } catch (e) { addToast(e.message, "error"); }
    finally { setLoading(false); }
  }, [token, addToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const validateForm = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required";
    if (!editUser && !form.password.trim()) e.password = "Password required";
    return e;
  };

  const handleCreate = async () => {
    const e = validateForm();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await UserService.create(token, form);
      addToast("User created successfully!", "success");
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", role: "viewer" });
      setErrors({});
      loadUsers();
    } catch (err) { addToast(err.message, "error"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await UserService.update(token, editUser.id, { role: form.role, name: form.name });
      addToast("User updated!", "success");
      setEditUser(null);
      loadUsers();
    } catch (err) { addToast(err.message, "error"); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (id) => {
    try {
      await UserService.deactivate(token, id);
      addToast("User deactivated.", "info");
      loadUsers();
    } catch (err) { addToast(err.message, "error"); }
  };

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: G.text0, fontFamily: G.sans }}>User Management</h2>
        <Btn variant="primary" onClick={() => { setForm({ name: "", email: "", password: "", role: "viewer" }); setErrors({}); setShowCreate(true); }}>
          <Ico.Plus /> New User
        </Btn>
      </div>

      {/* Permissions Matrix */}
      <Card style={{ padding: "20px 24px" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: G.text0, marginBottom: 14, fontFamily: G.sans }}>Role Permissions Matrix</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: G.sans, fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: "8px 14px", textAlign: "left", color: G.text2, fontWeight: 600 }}>Permission</th>
                {Object.values(ROLES).map(r => (
                  <th key={r.id} style={{ padding: "8px 14px", textAlign: "center" }}>
                    <Badge color={r.color}>{r.label}</Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSIONS).map(([key, val]) => (
                <tr key={key} style={{ borderTop: `1px solid ${G.border}` }}>
                  <td style={{ padding: "10px 14px", color: G.text1 }}>
                    {val.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </td>
                  {Object.values(ROLES).map(r => (
                    <td key={r.id} style={{ padding: "10px 14px", textAlign: "center" }}>
                      {r.permissions.includes(val)
                        ? <span style={{ color: G.green, fontSize: 16 }}>✓</span>
                        : <span style={{ color: G.text2, fontSize: 16 }}>—</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {loading
        ? <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
        : <Card style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: G.sans }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${G.border}` }}>
                  {["User","Email","Role","Status","Joined","Actions"].map(h => (
                    <th key={h} style={{ padding: "13px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: G.text2, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const role = ROLES[u.role.toUpperCase()];
                  return (
                    <tr key={u.id}
                      style={{ borderBottom: i < users.length - 1 ? `1px solid ${G.border}` : "none" }}
                      onMouseEnter={e => e.currentTarget.style.background = G.surfaceHover}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "13px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${role?.color}20`, border: `1px solid ${role?.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: role?.color }}>
                            {u.avatar}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: G.text0 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "13px 18px", fontSize: 12, color: G.text2, fontFamily: G.mono }}>{u.email}</td>
                      <td style={{ padding: "13px 18px" }}><Badge color={role?.color}><Ico.Shield /> {role?.label}</Badge></td>
                      <td style={{ padding: "13px 18px" }}><Badge color={u.active ? G.green : G.red}>{u.active ? "Active" : "Inactive"}</Badge></td>
                      <td style={{ padding: "13px 18px", fontSize: 12, color: G.text2, fontFamily: G.mono }}>{u.createdAt}</td>
                      <td style={{ padding: "13px 18px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Btn small variant="ghost" onClick={() => { setEditUser(u); setForm({ name: u.name, email: u.email, password: "", role: u.role }); }}>
                            <Ico.Edit /> Edit
                          </Btn>
                          {u.active && <Btn small variant="danger" onClick={() => handleDeactivate(u.id)}>Deactivate</Btn>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
      }

      {showCreate && (
        <Modal title="Create New User" onClose={() => { setShowCreate(false); setErrors({}); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Full Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="John Doe" error={errors.name} />
            <Input label="Email" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="john@anedya.io" error={errors.email} />
            <Input label="Password" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="Min 8 characters" error={errors.password} />
            <Select label="Role" value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} options={Object.values(ROLES).map(r => ({ value: r.id, label: r.label }))} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>Cancel</Btn>
              <Btn variant="primary" onClick={handleCreate} loading={saving} style={{ flex: 1 }}>Create User</Btn>
            </div>
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal title={`Edit — ${editUser.name}`} onClose={() => setEditUser(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Full Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
            <Select label="Role" value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} options={Object.values(ROLES).map(r => ({ value: r.id, label: r.label }))} />
            <div style={{ background: `${G.purple}0d`, border: `1px solid ${G.purple}25`, borderRadius: 9, padding: "12px 14px", fontSize: 12, color: G.purple }}>
              <Ico.Shield /> Permissions update automatically based on the selected role.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setEditUser(null)} style={{ flex: 1 }}>Cancel</Btn>
              <Btn variant="primary" onClick={handleUpdate} loading={saving} style={{ flex: 1 }}>Save Changes</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  17. DASHBOARD LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

function DashboardLayout() {
  const { user, token, can } = useAuth();
  const [activePage, setActivePage]     = useState("dashboard");
  const [devices, setDevices]           = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [toasts, setToasts]             = useState([]);
  const [lastUpdated, setLastUpdated]   = useState(new Date());
  const [refreshing, setRefreshing]     = useState(false);

  const addToast = useCallback((message, type) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type: type || "info" }]);
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const data = await DeviceService.getAll(token);
      setDevices(data);
      setSelectedDevice(prev => data.find(d => d.id === prev?.id) || data[0] || null);
      setLastUpdated(new Date());
    } catch (e) { addToast(e.message, "error"); }
  }, [token, addToast]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  useEffect(() => {
    const id = setInterval(() => { DeviceService.liveUpdate(); loadDevices(); }, 5000);
    return () => clearInterval(id);
  }, [loadDevices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDevices();
    setRefreshing(false);
    addToast("Data refreshed", "success");
  };

  const handleToggleRelay = async (deviceId) => {
    try {
      const updated = await DeviceService.toggleRelay(token, deviceId);
      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, relay: updated.relay } : d));
      addToast(`Relay ${updated.relay ? "activated" : "deactivated"} for ${updated.name}`, updated.relay ? "success" : "info");
    } catch (e) { addToast(e.message, "error"); }
  };

  const role = ROLES[user?.role?.toUpperCase()];
  const pageTitle = { dashboard: "Dashboard", analytics: "Analytics", devices: "Device Management", users: "User Management" };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: G.bg0, fontFamily: G.sans }}>
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {/* Topbar */}
        <div style={{
          height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px", borderBottom: `1px solid ${G.border}`,
          background: "rgba(10,15,30,0.8)", backdropFilter: "blur(20px)",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: G.text0 }}>{pageTitle[activePage]}</h1>
            <p style={{ fontSize: 11, color: G.text2, fontFamily: G.mono }}>{lastUpdated.toLocaleTimeString()} · Live updates every 5s</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Btn variant="ghost" small onClick={handleRefresh}>
              <span style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none", display: "flex" }}><Ico.Refresh /></span>
              Refresh
            </Btn>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `${role?.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: role?.color }}>
                {user?.avatar}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: G.text0 }}>{user?.name}</p>
                <Badge color={role?.color} style={{ fontSize: 9, padding: "1px 6px" }}>{role?.label}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "24px 28px" }}>
          {activePage === "dashboard" && (
            <DashboardPage devices={devices} onToggleRelay={handleToggleRelay} onSelectDevice={setSelectedDevice} selectedDevice={selectedDevice} />
          )}
          {activePage === "analytics" && can(PERMISSIONS.VIEW_ANALYTICS) && (
            <AnalyticsPage devices={devices} token={token} />
          )}
          {activePage === "devices" && (
            <DevicesPage devices={devices} onToggleRelay={handleToggleRelay} />
          )}
          {activePage === "users" && can(PERMISSIONS.MANAGE_USERS) && (
            <UsersPage token={token} addToast={addToast} />
          )}
          {((activePage === "analytics" && !can(PERMISSIONS.VIEW_ANALYTICS)) ||
            (activePage === "users"     && !can(PERMISSIONS.MANAGE_USERS))) && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: G.red, transform: "scale(1.8)", display: "flex" }}><Ico.Shield /></span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: G.text0 }}>Access Denied</h3>
              <p style={{ fontSize: 13, color: G.text2, textAlign: "center", maxWidth: 320 }}>You don't have permission to view this page. Contact your administrator.</p>
              <Btn variant="ghost" onClick={() => setActivePage("dashboard")}>Return to Dashboard</Btn>
            </div>
          )}
        </div>
      </main>

      {toasts.slice(-1).map(t => (
        <Toast key={t.id} message={t.message} type={t.type}
          onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  18. PROTECTED ROUTE
// ─────────────────────────────────────────────────────────────────────────────

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: G.bg0 }}>
      <Spinner size={36} />
    </div>
  );
  return user ? children : <LoginPage />;
}

// ─────────────────────────────────────────────────────────────────────────────
//  19. ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <style>{CSS}</style>
      <AuthProvider>
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      </AuthProvider>
    </>
  );
}
