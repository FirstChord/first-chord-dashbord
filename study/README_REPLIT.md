# Tutor Me - Replit Deployment

## 🚀 Quick Setup in Replit

### 1. Create New Repl
1. Go to [replit.com](https://replit.com)
2. Click "Create Repl"
3. Choose "Import from GitHub" (or upload folder)
4. Upload your `study/` folder

### 2. Set Environment Variables
In Replit's "Secrets" tab, add:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Install Dependencies
Replit will auto-install from `requirements.txt`, or run:
```bash
pip install -r requirements.txt
```

### 4. Run the App
Click the "Run" button or use:
```bash
python3 main.py
```

### 5. Get Your Live URL
Replit will give you a live URL like:
`https://tutor-me-yourname.replit.app`

## 📱 Features That Work on Replit

✅ **Dashboard** - Full web interface  
✅ **Quick Capture** - Copy/paste from TutorMe  
✅ **AI Card Generation** - Uses your Gemini API key  
✅ **Session Management** - Edit/delete sessions  
✅ **Anki Export** - CSV download  
❌ **Direct Anki Import** - Requires Anki desktop (local only)

## 🔧 File Structure
```
study/
├── main.py              # Replit entry point
├── dashboard.py         # Main Flask app
├── requirements.txt     # Dependencies
├── .replit             # Replit configuration
├── templates/          # HTML templates
├── commands/           # CLI commands
├── data/              # Your session & card data
└── prompts/           # AI prompts
```

## 🌐 Usage
1. **Access your live URL anywhere**
2. **Copy TutorMe conversations** 
3. **Quick capture** with one click
4. **Generate flashcards** with AI
5. **Download CSV** for Anki import

Perfect for studying on any device! 📚