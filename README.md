 # 🌐 Anedya IoT Dashboard

A fully functional, production-grade **IoT Analytics Dashboard** built with **React** and **Create React App**. It features real-time device monitoring, historical data visualization, relay control, secure authentication, and Role-Based Access Control (RBAC).

---

## 🚀 Live Demo

> **URL:** `(https://iotdashboard-chi.vercel.app/)`

### Demo Login Credentials

| Role     | Email                   | Password      |
|----------|-------------------------|---------------|
| Admin    | admin@anedya.io         | admin123      |
| Operator | operator@anedya.io      | operator123   |
| Viewer   | viewer@anedya.io        | viewer123     |

---

## 📸 Features Overview

- 🔐 **Secure Authentication** — Email/password login with token-based session management
- 👥 **Role-Based Access Control (RBAC)** — Admin, Operator, Viewer roles with fine-grained permissions
- 📊 **Real-Time Dashboard** — Live temperature, humidity, battery, and online/offline status
- 📈 **Historical Analytics** — 24h area charts and node comparison bar charts
- ⚡ **Relay Control** — Toggle device relays in real-time (Operator/Admin only)
- 🔔 **Alert System** — Automatic alerts for offline devices and low battery
- 👤 **User Management** — Create, edit, assign roles, and deactivate users (Admin only)
- 🛡️ **Protected Routes** — Unauthorized users are blocked from accessing the dashboard
- 🔄 **Auto Refresh** — Live data updates every 5 seconds automatically

---

## 🛠️ Tech Stack

| Technology        | Purpose                          |
|-------------------|----------------------------------|
| React 19          | UI Framework                     |
| Create React App  | Project scaffolding & build tool |
| Recharts          | Charts & data visualization      |
| React Context API | Global auth state management     |
| sessionStorage    | Token persistence across tabs    |
| CSS-in-JS (inline)| Component-level styling          |
| gh-pages          | GitHub Pages deployment          |

---

## 🏗️ Project Architecture

```
anedya-dashboard/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx              # Main application file (all components)
│   ├── index.js             # React entry point
│   └── index.css            # Global reset styles
├── package.json             # Dependencies & scripts
└── README.md
```

### App.jsx Internal Structure (19 Modules)

```
 1. CONSTANTS & PERMISSIONS    — PERMISSIONS object, ROLES definitions
 2. MOCK DATABASE              — Users, devices, sessions (simulates backend)
 3. HELPERS                    — delay(), requireAuth(), requirePermission(), generateHistory()
 4. SERVICES                   — AuthService, UserService, DeviceService (mock API layer)
 5. AUTH CONTEXT               — React Context for global auth state
 6. DESIGN TOKENS              — Color palette, typography, spacing constants (G object)
 7. GLOBAL STYLES              — CSS animations, scrollbar, font imports
 8. UI PRIMITIVES              — Card, Badge, Btn, Input, Select, Toast, Modal, Spinner
 9. ICONS                      — Inline SVG icon components
10. LOGIN PAGE                 — Auth form with demo account shortcuts
11. SIDEBAR                    — Navigation filtered by user permissions
12. DEVICE CARD                — Individual device display with relay toggle
13. STAT CARD                  — Summary metric cards
14. DASHBOARD PAGE             — Main overview with stats, alerts, device cards
15. ANALYTICS PAGE             — 24h area charts + comparison bar charts
16. DEVICES PAGE               — Full device table with relay controls
17. USERS PAGE                 — User management table + create/edit modals
18. DASHBOARD LAYOUT           — Main layout with sidebar, topbar, routing
19. PROTECTED ROUTE            — Auth guard component
20. ROOT APP                   — AuthProvider + ProtectedRoute + DashboardLayout
```

---

## 🔐 Authentication System

The app simulates a real backend authentication system:

- User submits email + password
- `AuthService.login()` validates credentials against the mock DB
- A token (`tok_xxxx_timestamp`) is generated and stored in `DB.sessions`
- Token is saved to `sessionStorage` for persistence
- Every API call validates the token before executing
- Tokens expire after **1 hour**
- Deactivated accounts are blocked from logging in

---

## 👥 Role-Based Access Control (RBAC)

### Permission Matrix

| Permission           | Admin | Operator | Viewer |
|----------------------|:-----:|:--------:|:------:|
| View Dashboard       |  ✓    |    ✓     |   ✓    |
| View Analytics       |  ✓    |    ✓     |   ✓    |
| View All Devices     |  ✓    |    ✓     |   ✗    |
| Control Relay        |  ✓    |    ✓     |   ✗    |
| Manage Users         |  ✓    |    ✗     |   ✗    |

### How RBAC Works

1. Each role has a `permissions` array defined in the `ROLES` constant
2. `AuthContext` exposes a `can(permission)` helper function
3. Every component checks `can(PERMISSIONS.XXX)` before rendering controls
4. Sidebar nav items are filtered — users only see pages they can access
5. API service layer enforces permissions server-side via `requirePermission()`
6. Forbidden pages show an **Access Denied** screen

---

## 📊 Device Data & Live Updates

### Mock Devices

| Node ID   | Name        | Location   |
|-----------|-------------|------------|
| node-001  | Living Room | Floor 1    |
| node-002  | Server Room | Floor 2    |
| node-003  | Greenhouse  | Rooftop    |
| node-004  | Warehouse   | Building B |

### Live Update Mechanism

- `DeviceService.liveUpdate()` simulates real IoT sensor fluctuations every **5 seconds**
- Temperature drifts ±0.8°C per tick
- Humidity drifts ±1.5% per tick (clamped between 20–95%)
- Manual **Refresh** button triggers an immediate data reload

### Relay Control

- Operator and Admin users can toggle relay ON/OFF
- Offline devices cannot be controlled (disabled with tooltip)
- Toggle uses animated switch UI with loading spinner during operation

---

## 📈 Analytics & Charts

Built with **Recharts**:

- **Area Charts** — 24h temperature and humidity trend for selected device
- **Bar Charts** — Side-by-side comparison of all nodes (temp + humidity)
- **Custom Tooltip** — Styled dark tooltip showing exact values
- Data is generated with sine/cosine waves + randomness to simulate realistic sensor curves

---

## ⚙️ Installation & Local Development

### Prerequisites

- Node.js v16 or higher
- npm v8 or higher

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_GITHUB_USERNAME/anedya-dashboard.git

# 2. Navigate into the project
cd anedya-dashboard

# 3. Install dependencies
npm install

# 4. Start the development server
npm start
```

The app will open at **http://localhost:3000**

---

## 🌍 Deployment to GitHub Pages

### One-Time Setup

1. Create a GitHub repository named `anedya-dashboard`
2. Update `package.json` homepage field:
   ```json
   "homepage": "https://YOUR_GITHUB_USERNAME.github.io/anedya-dashboard"
   ```
3. Push code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/anedya-dashboard.git
   git push -u origin main
   ```
4. Deploy:
   ```bash
   npm run deploy
   ```
5. Go to **GitHub → Settings → Pages → Source → gh-pages branch** → Save

### Redeploying After Changes

```bash
git add .
git commit -m "Update"
git push
npm run deploy
```

---

## 📦 Available Scripts

| Script            | Description                              |
|-------------------|------------------------------------------|
| `npm start`       | Run development server at localhost:3000 |
| `npm run build`   | Build production bundle into `/build`    |
| `npm test`        | Run test suite                           |
| `npm run deploy`  | Build and deploy to GitHub Pages         |

---

## 🔧 Connecting Real Anedya Cloud APIs

This project currently uses mock data. To connect to real **Anedya Cloud APIs**:

1. Replace `DB.devices` with API calls to Anedya's device endpoints
2. Replace `DeviceService.getAll()` with:
   ```js
   const res = await fetch('https://api.anedya.io/v1/nodes', {
     headers: { 'Authorization': `Bearer ${YOUR_API_KEY}` }
   });
   ```
3. Replace `DeviceService.getHistory()` with Anedya's historical data endpoint
4. Replace `DeviceService.toggleRelay()` with Anedya's command endpoint
5. Store your API key securely using environment variables:
   ```
   REACT_APP_ANEDYA_API_KEY=your_key_here
   ```

---

## 🎨 Design System

| Token       | Value                                  | Usage              |
|-------------|----------------------------------------|--------------------|
| `bg0`       | `#05080f`                              | App background     |
| `bg1`       | `#0a0f1e`                              | Sidebar background |
| `bg2`       | `#0f1628`                              | Modal background   |
| `accent`    | `#4fc3f7`                              | Primary accent     |
| `amber`     | `#fbbf24`                              | Temperature color  |
| `green`     | `#34d399`                              | Online / success   |
| `red`       | `#f87171`                              | Error / offline    |
| `purple`    | `#a78bfa`                              | Relay / info       |
| Font (sans) | Sora                                   | UI text            |
| Font (mono) | JetBrains Mono                         | Numbers / IDs      |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👨‍💻 Author

Built with ❤️ using React + Recharts + Anedya IoT Cloud

> Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username throughout this file.
