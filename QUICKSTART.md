# Legal Document Filler - Quick Start Guide

## Prerequisites

1. **Python 3.8+** installed
2. **Node.js 16+** installed  
3. **OpenAI API Key** - Get one from https://platform.openai.com/api-keys

## Setup Steps

### 1. Set OpenAI API Key

You have two options:

**Option A: Using .env file (Recommended)**
1. Copy the example file:
   ```bash
   cd backend
   copy .env.example .env
   ```
   (On Linux/Mac: `cp .env.example .env`)
2. Open `.env` file and replace `your-api-key-here` with your actual OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

**Option B: Using Terminal/Environment Variable**
- **Windows PowerShell:**
  ```powershell
  $env:OPENAI_API_KEY="your-api-key-here"
  ```
- **Windows CMD:**
  ```cmd
  set OPENAI_API_KEY=your-api-key-here
  ```
- **Linux/Mac:**
  ```bash
  export OPENAI_API_KEY="your-api-key-here"
  ```

> **Note:** If you use Option B, you'll need to set it every time you open a new terminal. Option A (using .env file) is more convenient as it's automatically loaded when you start the server.

### 2. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 4. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
python main.py
```
Backend will run on `http://localhost:8000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```
Frontend will run on `http://localhost:3000`

### 5. Use the Application

1. Open `http://localhost:3000` in your browser
2. Upload a `.docx` file with placeholders (e.g., `[CLIENT_NAME]`, `[DATE]`)
3. Answer the questions asked by the AI
4. Download the completed PDF document

## Example Document Format

Your `.docx` file can contain placeholders like:
- `[CLIENT_NAME]`
- `[CONTRACT_DATE]`
- `[AMOUNT]`
- `[ADDRESS]`

The AI will automatically detect these and ask relevant questions to fill them in.

## Troubleshooting

- **"OPENAI_API_KEY not found"**: Make sure you've set the environment variable before starting the backend
- **Port already in use**: Change the port in `backend/main.py` (line 301) or frontend port in `frontend/package.json`
- **Import errors**: Make sure all dependencies are installed correctly

## Notes

- No database required - all data is stored in memory (sessions are lost on server restart)
- Make sure your OpenAI API key has sufficient credits
- The app uses GPT-4 for best results

