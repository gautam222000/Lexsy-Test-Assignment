import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as docx from 'docx-preview';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [step, setStep] = useState('upload'); // upload, conversation, complete
  const [sessionId, setSessionId] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState([]); // Array of {role: 'user'|'assistant', content: string}
  const [inputMessage, setInputMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [generating, setGenerating] = useState(false); // Track document generation
  const [completedText, setCompletedText] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.75);
  const documentPreviewRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const newSessionId = response.data.session_id;
      setSessionId(newSessionId);
      setMessages([]);
      setStep('conversation');
      
      // Display GPT's first response (the initial question)
      if (response.data.message) {
        setMessages([{
          role: 'assistant',
          content: response.data.message
        }]);
      }
      
      // Fetch and render document preview
      try {
        const docResponse = await axios.get(`${API_BASE_URL}/document/${newSessionId}`, {
          responseType: 'blob'
        });
        
        // Render DOCX using docx-preview
        const blob = new Blob([docResponse.data], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        
        // Wait for the next render cycle to ensure the ref is available
        setTimeout(() => {
          if (documentPreviewRef.current) {
            docx.renderAsync(blob, documentPreviewRef.current, null, {
              className: 'docx-preview',
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              ignoreLastRenderedPageBreak: true,
              experimental: false,
              trimXmlDeclaration: true,
              useBase64URL: false,
              useMathMLPolyfill: true,
              showChanges: false,
              showComments: false,
              showInserted: true,
              showDeleted: false,
              showFormattingChanges: true
            });
            setDocumentLoaded(true); // Set a flag to indicate it's loaded
          }
        }, 100);
      } catch (error) {
        console.error('Error fetching document preview:', error);
      }
      
      // Note: We don't call startConversation() here anymore
      // GPT's first question is already displayed above from the upload response
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading file: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending) {
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    // Add user message to conversation
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    try {
      const response = await axios.post(`${API_BASE_URL}/ask-question`, {
        session_id: sessionId,
        message: userMessage,
      });

      // Add assistant response to conversation
      if (response.data.message) {
        setMessages([...newMessages, {
          role: 'assistant',
          content: response.data.message
        }]);
      }

      // If complete, automatically generate document
      if (response.data.is_complete) {
        setIsComplete(true);
        // Show the completion message first, then generate document after a brief delay
        setTimeout(async () => {
          await completeDocument(sessionId);
        }, 1000); // Small delay to show the completion message
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message: ' + (error.response?.data?.detail || error.message));
      // Remove the user message if there was an error
      setMessages(messages);
    } finally {
      setSending(false);
    }
  };

  const completeDocument = async (sessionIdToUse = null) => {
    try {
      const idToUse = sessionIdToUse || sessionId;
      if (!idToUse) {
        console.error('No session ID available');
        return;
      }

      setGenerating(true); // Show generating state

      const response = await axios.post(`${API_BASE_URL}/complete-document?session_id=${idToUse}`);

      setCompletedText(response.data.completed_text);
      setGenerating(false);
      setStep('complete');
    } catch (error) {
      console.error('Error completing document:', error);
      setGenerating(false);
      alert('Error completing document: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDownloadOriginal = async () => {
    setDownloading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/document/${sessionId}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'original_document.docx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading:', error);
      alert('Error downloading document: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadDocx = async () => {
    setDownloading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/download/${sessionId}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'completed_document.docx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading:', error);
      alert('Error downloading DOCX: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDownloading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setSessionId(null);
    setFile(null);
    setMessages([]);
    setInputMessage('');
    setIsComplete(false);
    setGenerating(false);
    setCompletedText('');
    setDocumentLoaded(false);
    setZoomLevel(0.75);
    if (documentPreviewRef.current) {
      documentPreviewRef.current.innerHTML = '';
    }
  };

  const handleCompleteManually = async () => {
    if (sending || generating) return;
    
    setGenerating(true);
    try {
      // Try to complete the document (with force=true to allow partial replacements)
      const response = await axios.post(`${API_BASE_URL}/complete-document?session_id=${sessionId}&force=true`);
      setCompletedText(response.data.completed_text);
      setGenerating(false);
      setStep('complete');
    } catch (error) {
      console.error('Error completing document:', error);
      setGenerating(false);
      const errorMsg = error.response?.data?.detail || error.message;
      alert('Error completing document: ' + errorMsg);
    }
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>Legal Document Filler</h1>
          <p>Upload your document and fill in placeholders through conversation</p>
        </header>

        {step === 'upload' && (
          <div className="upload-section">
            <div className="upload-box">
              {!uploading && (
                <>
                  <h2>Upload Document</h2>
                  <p>Please upload a .docx file containing your legal document draft</p>
                  <input
                    type="file"
                    accept=".docx"
                    onChange={handleFileChange}
                    className="file-input"
                    id="file-input"
                  />
                  <label htmlFor="file-input" className="file-label">
                    {file ? file.name : 'Choose File'}
                  </label>
                  <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="upload-button"
                  >
                    Upload & Analyze
                  </button>
                </>
              )}
              {uploading && (
                <div className="uploading-state">
                  <div className="spinner-container">
                    <div className="spinner"></div>
                  </div>
                  <h2>Analyzing Document</h2>
                  <p className="analyzing-text">We're analyzing your document to identify placeholders and preparing the conversation...</p>
                  <div className="progress-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'conversation' && (
          <div className="conversation-section">
            <div className="conversation-layout">
              {/* Document Preview Side */}
              <div className="document-preview-panel">
                <div className="preview-header">
                  <h3>Document Preview</h3>
                  <button
                    onClick={handleDownloadOriginal}
                    disabled={downloading}
                    className="download-preview-button"
                    title="Download original document"
                  >
                    Download
                  </button>
                </div>
                <div className="document-preview-content">
                  <div 
                    ref={documentPreviewRef} 
                    className="docx-wrapper"
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'top left',
                      padding: '20px 40px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      width: `${100 / zoomLevel}%`,
                      minHeight: `${100 / zoomLevel}%`
                    }}
                  >
                    {!documentLoaded && (
                      <div className="loading-preview">Loading preview...</div>
                    )}
                  </div>
                  <div className="zoom-controls">
                    <button
                      className="zoom-button"
                      onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
                      title="Zoom out"
                    >
                      −
                    </button>
                    <span className="zoom-button" style={{ cursor: 'default', pointerEvents: 'none' }}>
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      className="zoom-button"
                      onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.1))}
                      title="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Side */}
              <div className="conversation-panel">
                <div className="conversation-box">
                  {!isComplete && !generating && (
                    <div className="generate-document-header">
                      <button
                        onClick={handleCompleteManually}
                        disabled={sending || generating}
                        className="generate-document-button"
                        title="Generate document with current answers (even if incomplete)"
                      >
                        Generate Document
                      </button>
                    </div>
                  )}
                  
                  <div className="messages-container">
                    {messages.map((msg, index) => (
                      <div key={index} className={`message ${msg.role}`}>
                        <div className="message-content">{msg.content}</div>
                      </div>
                    ))}
                    {sending && (
                      <div className="message assistant">
                        <div className="message-content typing">Thinking...</div>
                      </div>
                    )}
                    {generating && (
                      <div className="message assistant">
                        <div className="message-content generating">
                          <div className="generating-content">
                            <div className="generating-spinner"></div>
                            <span>Generating your completed document...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {!isComplete && !generating && (
                    <div className="input-container">
                      <div className="input-wrapper">
                        <textarea
                          value={inputMessage}
                          onChange={handleInputChange}
                          onKeyPress={handleKeyPress}
                          placeholder="Message..."
                          className="message-input"
                          rows="1"
                          disabled={sending}
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!inputMessage.trim() || sending}
                          className="send-icon-button"
                          title="Send message"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.854 0.646a.5.5 0 0 1 .11.54l-7 14a.5.5 0 0 1-.928.082L4.5 9.5l-4.646 4.646a.5.5 0 0 1-.707-.707l5-5a.5.5 0 0 1 .707 0L9.5 1.573l6.354-2.927a.5.5 0 0 1 .54.11z" fill="currentColor"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="complete-section">
            <div className="complete-box">
              <h2>Document Completed</h2>
              <p>Your document has been filled in and is ready to download.</p>

              <div className="completed-text-preview">
                <h3>Preview:</h3>
                <div className="text-content">
                  {completedText.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>

              <div className="actions">
                <button
                  onClick={handleDownloadDocx}
                  disabled={downloading}
                  className="download-button"
                >
                  {downloading ? 'Downloading...' : 'Download DOCX'}
                </button>
                <button onClick={handleReset} className="reset-button">
                  Start New Document
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

