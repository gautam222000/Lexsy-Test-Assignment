import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as docx from 'docx-preview';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

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
  const [completedZoomLevel, setCompletedZoomLevel] = useState(0.75);
  const [replacements, setReplacements] = useState({}); // Store replacements for highlighting
  const documentPreviewRef = useRef(null);
  const completedDocumentPreviewRef = useRef(null);
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
        timeout: 120000, // 120 seconds timeout (2 minutes)
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

  // Function to highlight replacements in completed document
  const highlightReplacements = (replacementsData) => {
    if (!completedDocumentPreviewRef.current || !replacementsData || Object.keys(replacementsData).length === 0) return;
    
    try {
      // Get all replacement values as normalized strings
      const replacementValues = Object.values(replacementsData)
        .map(v => String(v).trim())
        .filter(v => v.length > 0);
      
      if (replacementValues.length === 0) return;
      
      // Create a set for faster lookup
      const replacementSet = new Set(replacementValues.map(v => v.toLowerCase()));
      
      // Find and highlight all replacement values in the completed document
      const walker = document.createTreeWalker(
        completedDocumentPreviewRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim().length > 0) {
          textNodes.push(node);
        }
      }
      
      // Highlight nodes containing replacement values
      textNodes.forEach(textNode => {
        const text = textNode.textContent.trim();
        if (!text || text.length < 1) return;
        
        // Split text into words for precise matching
        // Remove punctuation and split by whitespace
        const words = text
          .replace(/[.,;:!?()[\]{}'"`]/g, ' ') // Replace punctuation with spaces
          .split(/\s+/) // Split by whitespace
          .map(w => w.trim())
          .filter(w => w.length > 0);
        
        // Check if any word exactly matches a replacement value
        const hasExactMatch = words.some(word => {
          const normalizedWord = word.toLowerCase();
          return replacementSet.has(normalizedWord);
        });
        
        // Also check for exact text match (for values that might be multi-word or have special characters)
        const exactTextMatch = replacementValues.some(replacement => {
          const normalizedText = text.toLowerCase();
          const normalizedReplacement = replacement.toLowerCase();
          // Exact match only - no partial matches
          return normalizedText === normalizedReplacement;
        });
        
        if (hasExactMatch || exactTextMatch) {
          // Find parent element to highlight
          let parent = textNode.parentElement;
          while (parent && parent !== completedDocumentPreviewRef.current) {
            if (parent.tagName === 'P' || parent.tagName === 'TD' || parent.tagName === 'SPAN' || parent.tagName === 'DIV') {
              // Check if already highlighted
              const currentBg = window.getComputedStyle(parent).backgroundColor;
              if (currentBg !== 'rgb(255, 255, 0)' && currentBg !== 'yellow') {
                parent.style.backgroundColor = '#ffff00';
                parent.style.padding = '2px 4px';
                parent.style.borderRadius = '2px';
              }
              break;
            }
            parent = parent.parentElement;
          }
        }
      });
    } catch (error) {
      console.error('Error highlighting replacements:', error);
    }
  };
  
  // Enhanced function to render documents and highlight replacements
  const renderDocumentsWithHighlighting = async (originalBlob, completedBlob, replacementsData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (documentPreviewRef.current) {
          docx.renderAsync(originalBlob, documentPreviewRef.current, null, {
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
          }).then(() => {
            if (completedDocumentPreviewRef.current) {
              docx.renderAsync(completedBlob, completedDocumentPreviewRef.current, null, {
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
              }).then(() => {
                // After both render, highlight replacements
                setTimeout(() => {
                  highlightReplacements(replacementsData);
                  resolve();
                }, 500);
              });
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      }, 100);
    });
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
      setReplacements(response.data.replacements || {}); // Store replacements for highlighting
      setGenerating(false);
      setStep('complete');
      
      // Fetch and render both documents with highlighting
      try {
        // Render original document
        const originalDocResponse = await axios.get(`${API_BASE_URL}/document/${idToUse}`, {
          responseType: 'blob'
        });
        const originalBlob = new Blob([originalDocResponse.data], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        
        // Render completed document
        const completedDocResponse = await axios.get(`${API_BASE_URL}/download/${idToUse}`, {
          responseType: 'blob'
        });
        const completedBlob = new Blob([completedDocResponse.data], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        
        // Render documents with highlighting
        await renderDocumentsWithHighlighting(originalBlob, completedBlob, response.data.replacements || {});
      } catch (error) {
        console.error('Error fetching documents for preview:', error);
      }
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
    setCompletedZoomLevel(0.75);
    setReplacements({});
    if (documentPreviewRef.current) {
      documentPreviewRef.current.innerHTML = '';
    }
    if (completedDocumentPreviewRef.current) {
      completedDocumentPreviewRef.current.innerHTML = '';
    }
  };

  const handleCompleteManually = async () => {
    if (sending || generating) return;
    
    setGenerating(true);
    try {
      // Try to complete the document (with force=true to allow partial replacements)
      const response = await axios.post(`${API_BASE_URL}/complete-document?session_id=${sessionId}&force=true`);
      setCompletedText(response.data.completed_text);
      setReplacements(response.data.replacements || {}); // Store replacements for highlighting
      setGenerating(false);
      setStep('complete');
      
      // Fetch and render both documents with highlighting
      try {
        // Render original document
        const originalDocResponse = await axios.get(`${API_BASE_URL}/document/${sessionId}`, {
          responseType: 'blob'
        });
        const originalBlob = new Blob([originalDocResponse.data], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        
        // Render completed document
        const completedDocResponse = await axios.get(`${API_BASE_URL}/download/${sessionId}`, {
          responseType: 'blob'
        });
        const completedBlob = new Blob([completedDocResponse.data], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        
        // Render documents with highlighting
        await renderDocumentsWithHighlighting(originalBlob, completedBlob, response.data.replacements || {});
      } catch (error) {
        console.error('Error fetching documents for preview:', error);
      }
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

        {step === 'upload' && (
          <div className="upload-section">
            <div className="upload-box">
              {!uploading && (
                <>
                  <h2>Legal Document Filler</h2>
                  <div className="app-description">
                    <p className="description-main">
                      Upload your legal document template and let our AI assistant help you fill in all the placeholders through a simple conversation.
                    </p>
                    <div className="description-steps">
                      <div className="step-item">
                        <span className="step-number">1</span>
                        <span className="step-text">Upload your .docx document with placeholders</span>
                      </div>
                      <div className="step-item">
                        <span className="step-number">2</span>
                        <span className="step-text">Answer questions about the missing information</span>
                      </div>
                      <div className="step-item">
                        <span className="step-number">3</span>
                        <span className="step-text">Download your completed document</span>
                      </div>
                    </div>
                  </div>
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
                  <div className="chat-info-note">
                    <span className="info-icon">i</span>
                    <span className="info-text">
                      If the AI generates incorrect responses or doesn't work as intended, please upload the document again.
                    </span>
                  </div>
                  
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
            <div className="complete-layout">
              {/* Original Document Side */}
              <div className="document-preview-panel">
                <div className="preview-header">
                  <h3>Original Document</h3>
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

              {/* Completed Document Side */}
              <div className="document-preview-panel">
                <div className="preview-header">
                  <h3>Completed Document</h3>
                  <button
                    onClick={handleDownloadDocx}
                    disabled={downloading}
                    className="download-preview-button"
                    title="Download completed document"
                  >
                    Download
                  </button>
                </div>
                <div className="document-preview-content">
                  <div 
                    ref={completedDocumentPreviewRef} 
                    className="docx-wrapper"
                    style={{
                      transform: `scale(${completedZoomLevel})`,
                      transformOrigin: 'top left',
                      padding: '20px 40px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      width: `${100 / completedZoomLevel}%`,
                      minHeight: `${100 / completedZoomLevel}%`
                    }}
                  >
                  </div>
                  <div className="zoom-controls">
                    <button
                      className="zoom-button"
                      onClick={() => setCompletedZoomLevel(Math.max(0.5, completedZoomLevel - 0.1))}
                      title="Zoom out"
                    >
                      −
                    </button>
                    <span className="zoom-button" style={{ cursor: 'default', pointerEvents: 'none' }}>
                      {Math.round(completedZoomLevel * 100)}%
                    </span>
                    <button
                      className="zoom-button"
                      onClick={() => setCompletedZoomLevel(Math.min(1.5, completedZoomLevel + 0.1))}
                      title="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="complete-info-wrapper">
              <div className="chat-info-note">
                <span className="info-icon">i</span>
                <span className="info-text">
                  If the AI generates incorrect responses or doesn't work as intended, please upload the document again.
                </span>
              </div>
            </div>
            
            <div className="complete-actions">
              <button onClick={handleReset} className="reset-button">
                Start New Document
              </button>
            </div>
          </div>
        )}
      </div>
      
      <footer className="app-footer">
        Lexsy Software Engineer Task by Gautam Trikkadeeri
      </footer>
    </div>
  );
}

export default App;

