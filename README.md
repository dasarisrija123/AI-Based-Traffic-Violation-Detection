# 🚦 TrafficAI - Smart Traffic Violation Detection System

AI-powered traffic violation detection using Claude (Anthropic) for image analysis, with Node.js backend and optional MongoDB database.

---

## 📁 File Structure

```
trafficai/
├── index.html      ← Frontend UI (open in browser)
├── style.css       ← Styling
├── script.js       ← Frontend JS + AI integration logic
├── server.js       ← Node.js backend (Express + Claude API)
├── .env            ← Your API keys (create this yourself)
└── README.md       ← This file
```

---

## 🚀 QUICK START (Frontend Only - Demo Mode)

1. Open `index.html` in your browser
2. Enter vehicle number, select violation, upload image
3. Click "Detect Violation"
4. System uses `localStorage` for storage in demo mode

---

## ⚙️ FULL SETUP (With AI Backend)

### Step 1: Install Node.js
Download from https://nodejs.org (v18+ recommended)

### Step 2: Get Anthropic API Key
1. Go to https://console.anthropic.com
2. Create an account and generate an API key
3. Copy the key (starts with `sk-ant-...`)

### Step 3: Install Dependencies
```bash
mkdir traffic-ai-backend
cd traffic-ai-backend

# Copy server.js here, then:
npm init -y
npm install express cors multer @anthropic-ai/sdk dotenv

# Optional:
npm install mongoose        # MongoDB database
npm install twilio          # SMS notifications
npm install nodemon -D      # Auto-restart in dev
```

### Step 4: Create .env File
Create a file named `.env` in the same folder as `server.js`:
```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
MONGODB_URI=mongodb://localhost:27017/trafficai
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_PHONE=+1234567890
PORT=5000
```

### Step 5: Start Backend
```bash
node server.js
# OR with auto-restart:
npx nodemon server.js
```
You should see:
```
🚦 TrafficAI Backend Server
📡 Running on: http://localhost:5000
🤖 AI Model: Claude claude-opus-4-6
```

### Step 6: Connect Frontend
In `script.js`, update the CONFIG object at the top:
```javascript
const CONFIG = {
    mode: 'backend',                          // Change from 'ai' to 'backend'
    backendURL: 'http://localhost:5000/api',  // Your server URL
    useBackendProxy: true
};
```

### Step 7: Open Frontend
Open `index.html` in your browser. Done! ✅

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server status check |
| POST | `/api/detect` | Main detection (supports image upload) |
| POST | `/api/analyze` | AI-only analysis (base64 image) |
| GET | `/api/violations/:vehicleNumber` | Get vehicle history |
| GET | `/api/stats` | Dashboard statistics |
| PATCH | `/api/violations/:challanId/status` | Update challan status |
| POST | `/api/notify/sms` | Send SMS notification via Twilio |

---

## 📊 Database (MongoDB - Optional)

### Install MongoDB
- Download from https://www.mongodb.com/try/download/community
- Start: `mongod` (Windows) or `brew services start mongodb-community` (Mac)

### Enable in server.js
Uncomment the mongoose lines in `server.js`:
```javascript
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);
// ... uncomment Violation schema and model
```

---

## 📱 SMS Notifications (Twilio)

1. Create account at https://www.twilio.com
2. Get a phone number (free trial available)
3. Add credentials to `.env`
4. Call `/api/notify/sms` from frontend

---

## ☁️ Deploy to Production

### Option A: Railway (Easiest)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```
Set environment variables in Railway dashboard.

### Option B: Render.com
1. Push code to GitHub
2. Connect repo at render.com
3. Set environment variables in dashboard

### Option C: AWS/Digital Ocean
```bash
# Install PM2 for process management
npm install -g pm2
pm2 start server.js --name trafficai
pm2 save
pm2 startup
```

---

## 🔧 Configuration Options (script.js)

```javascript
const CONFIG = {
    mode: 'ai',           // 'ai' = direct API, 'backend' = via server, 'local' = no AI
    backendURL: 'http://localhost:5000/api',
    useBackendProxy: true, // true = safer (API key stays on server)
    fines: {              // Customize fine amounts (₹)
        'No Helmet': 500,
        'Signal Jump': 1000,
        'Over Speed': 2000,
        // ... etc
    }
};
```

---

## ✅ Feature Checklist

- [x] AI image analysis (Claude Vision)
- [x] Drag & drop image upload
- [x] Violation fine calculation
- [x] Repeat offender detection (1.5x fine)
- [x] E-Challan generation
- [x] Real-time violation history
- [x] Dashboard statistics
- [x] Print/download challan
- [x] SMS notification (Twilio)
- [x] MongoDB database support
- [x] Production deployment guide

---

## 🆘 Troubleshooting

**"CORS error"** → Make sure backend is running and `backendURL` in script.js matches.

**"API key invalid"** → Check .env file has correct key with no spaces.

**"Cannot find module"** → Run `npm install` in the backend folder.

**Image not analyzing** → Only JPG/PNG supported. File size must be < 20MB.

---

*TrafficAI v2.0 | Built with Claude AI*
