#!/bin/bash
echo "Starting Legal Document Filler Backend in Development Mode..."
echo "Auto-reload enabled - changes will be detected automatically"
echo ""
echo "Make sure you have set your OPENAI_API_KEY in .env file!"
echo ""
cd backend
python main.py --dev

