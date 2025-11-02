# Legal Document Filler

A web application that helps you fill in placeholders in legal documents through an AI-powered conversational interface.

## Features

- 📄 Upload .docx legal documents
- 🤖 AI-powered analysis to identify placeholders
- 💬 Conversational Q&A to gather information
- ✨ Automatic document completion
- 📥 Download completed documents as PDF

## Tech Stack

- **Backend**: Python (FastAPI)
- **Frontend**: React
- **AI**: OpenAI GPT-4
- **Document Processing**: python-docx, reportlab

## Prerequisites

- Python 3.8+
- Node.js 16+
- OpenAI API key

## Setup Instructions

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Set your OpenAI API key. You can use either method:

**Option 1: Using .env file (Recommended)**
```bash
cd backend
copy .env.example .env  # Windows
# or: cp .env.example .env  # Linux/Mac
```
Then edit `.env` and add your API key:
```
OPENAI_API_KEY=your-api-key-here
```

**Option 2: Using Environment Variable**
```bash
# Windows PowerShell
$env:OPENAI_API_KEY="your-api-key-here"

# Linux/Mac
export OPENAI_API_KEY="your-api-key-here"
```

Start the backend server:

```bash
python main.py
```

The backend will run on `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

The frontend will run on `http://localhost:3000`

## Usage

1. Open `http://localhost:3000` in your browser
2. Upload a .docx file containing your legal document with placeholders
3. Answer the questions asked by the AI
4. Once all placeholders are filled, download the completed PDF

## API Endpoints

- `POST /upload` - Upload a document
- `POST /ask-question` - Ask/get next question
- `POST /complete-document` - Complete the document
- `GET /download/{session_id}` - Download completed PDF
- `GET /health` - Health check

## How It Works

1. **Document Upload**: The document is uploaded and its text is extracted
2. **Placeholder Analysis**: OpenAI analyzes the document to identify all dynamic placeholders
3. **Conversational Q&A**: OpenAI generates relevant questions for each placeholder
4. **Document Completion**: All answers are used to fill in the placeholders
5. **PDF Generation**: The completed document is converted to PDF format

## Notes

- No database is used - all data is stored in memory (sessions are lost on server restart)
- Make sure your OpenAI API key has sufficient credits
- The app uses GPT-4 for best results, but you can modify the model in `backend/main.py`

## License

MIT

