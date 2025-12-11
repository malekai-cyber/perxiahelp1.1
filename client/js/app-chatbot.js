// ============================================
// PERXIA HELP - CHATBOT JS
// Maneja la conversación con los modelos AI
// Incluye integración con RAG para documentos
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('📄 Inicializando Chatbot con RAG...');

        await authService.initPromise;
        const isAuthenticated = await authService.isAuthenticated();

        if (!isAuthenticated) {
            window.location.href = '/';
            return;
        }

        const account = authService.getAccount();
        if (account) {
            const userAvatarEl = document.getElementById('userAvatar');
            if (userAvatarEl && account.name) {
                const initials = account.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
                userAvatarEl.textContent = initials;
            }
        }

        // ===== DOM Elements =====
        const chatApp = document.getElementById('chatApp');
        const sidebar = document.getElementById('sidebar');
        const collapseSidebar = document.getElementById('collapseSidebar');
        const expandSidebar = document.getElementById('expandSidebar');
        const backBtn = document.getElementById('backBtn');
        const newChatBtn = document.getElementById('newChatBtn');
        const fileInput = document.getElementById('fileInput');
        const attachBtn = document.getElementById('attachBtn');
        const chatForm = document.getElementById('chatForm');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const chatMessages = document.getElementById('chatMessages');
        const welcomeScreen = document.getElementById('welcomeScreen');
        const currentModelDisplay = document.getElementById('currentModelDisplay');
        const suggestionBtns = document.querySelectorAll('.suggestion-btn');
        
        // Model selector elements
        const modelSelector = document.getElementById('modelSelector');
        const modelBtn = document.getElementById('modelBtn');
        const modelBtnText = document.getElementById('modelBtnText');
        const modelMenu = document.getElementById('modelMenu');
        const modelItems = document.querySelectorAll('.model-item');
        
        // Voice button
        const voiceBtn = document.getElementById('voiceBtn');
        
        // Docs panel elements
        const docsPanel = document.getElementById('docsPanel');
        const toggleDocsPanel = document.getElementById('toggleDocsPanel');
        const closePanelBtn = document.getElementById('closePanelBtn');
        const docsUploadZone = document.getElementById('docsUploadZone');
        const docsProgress = document.getElementById('docsProgress');
        const docsList = document.getElementById('docsList');
        const docsEmpty = document.getElementById('docsEmpty');
        const docsCount = document.getElementById('docsCount');
        const ragToggle = document.getElementById('ragToggle');
        const toastContainer = document.getElementById('toastContainer');
        
        // ===== State =====
        let currentModel = 'copilot';
        let isProcessing = false;
        let conversationHistory = [];
        let isRecording = false;
        let recognition = null;
        let uploadedDocuments = [];
        let useRAG = true;

        // ===== Toast Notifications =====
        function showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="toast-message">${message}</span>
            `;
            toastContainer.appendChild(toast);
            
            setTimeout(() => {
                toast.classList.add('toast-hide');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }

        // ===== UI Lock Functions =====
        function lockUI() {
            isProcessing = true;
            if (chatInput) {
                chatInput.disabled = true;
                chatInput.placeholder = 'Esperando respuesta...';
            }
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.classList.add('processing');
            }
            if (attachBtn) {
                attachBtn.disabled = true;
                attachBtn.style.opacity = '0.5';
                attachBtn.style.pointerEvents = 'none';
            }
            if (voiceBtn) {
                voiceBtn.disabled = true;
                voiceBtn.style.opacity = '0.5';
                voiceBtn.style.pointerEvents = 'none';
                if (isRecording && recognition) {
                    recognition.stop();
                }
            }
            if (modelBtn) {
                modelBtn.disabled = true;
                modelBtn.style.opacity = '0.5';
                modelBtn.style.pointerEvents = 'none';
            }
        }

        function unlockUI() {
            isProcessing = false;
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.placeholder = 'Escribe tu consulta...';
                chatInput.focus();
            }
            if (sendBtn) {
                sendBtn.disabled = !chatInput?.value.trim();
                sendBtn.classList.remove('processing');
            }
            if (attachBtn) {
                attachBtn.disabled = false;
                attachBtn.style.opacity = '1';
                attachBtn.style.pointerEvents = 'auto';
            }
            if (voiceBtn && !voiceBtn.classList.contains('not-supported')) {
                voiceBtn.disabled = false;
                voiceBtn.style.opacity = '1';
                voiceBtn.style.pointerEvents = 'auto';
            }
            if (modelBtn) {
                modelBtn.disabled = false;
                modelBtn.style.opacity = '1';
                modelBtn.style.pointerEvents = 'auto';
            }
        }

        // ===== Document Management =====
        async function loadDocuments() {
            try {
                const response = await fetch('/api/documents');
                const data = await response.json();
                
                if (data.success) {
                    uploadedDocuments = data.documents || [];
                    renderDocumentsList();
                }
            } catch (error) {
                console.log('📄 No hay documentos cargados aún');
                uploadedDocuments = [];
                renderDocumentsList();
            }
        }

        function renderDocumentsList() {
            if (!docsList || !docsEmpty || !docsCount) return;
            
            if (uploadedDocuments.length === 0) {
                docsList.innerHTML = '';
                docsEmpty.style.display = 'flex';
                docsCount.textContent = '0 documentos';
                return;
            }
            
            docsEmpty.style.display = 'none';
            docsCount.textContent = `${uploadedDocuments.length} documento${uploadedDocuments.length !== 1 ? 's' : ''}`;
            
            docsList.innerHTML = uploadedDocuments.map(doc => `
                <div class="doc-item" data-id="${doc.documentId}">
                    <div class="doc-icon">${getFileIcon(doc.filename)}</div>
                    <div class="doc-info">
                        <span class="doc-name" title="${doc.filename}">${truncateFilename(doc.filename, 25)}</span>
                        <span class="doc-meta">${doc.chunkCount || '?'} fragmentos</span>
                    </div>
                    <button class="doc-delete" title="Eliminar documento" data-id="${doc.documentId}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            `).join('');
            
            // Add delete event listeners
            docsList.querySelectorAll('.doc-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const docId = btn.dataset.id;
                    if (confirm('¿Eliminar este documento de la base de conocimientos?')) {
                        await deleteDocument(docId);
                    }
                });
            });
        }

        function getFileIcon(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            const icons = {
                'pdf': '📕',
                'doc': '📘',
                'docx': '📘',
                'txt': '📄',
                'md': '📝',
                'json': '📋'
            };
            return icons[ext] || '📄';
        }

        function truncateFilename(filename, maxLength) {
            if (filename.length <= maxLength) return filename;
            const ext = filename.split('.').pop();
            const name = filename.substring(0, filename.lastIndexOf('.'));
            const truncatedName = name.substring(0, maxLength - ext.length - 4) + '...';
            return `${truncatedName}.${ext}`;
        }

        async function uploadDocument(file) {
            const formData = new FormData();
            formData.append('document', file);
            formData.append('uploadedBy', account?.name || 'Usuario');
            
            // Show progress
            if (docsProgress) {
                docsProgress.style.display = 'block';
                document.getElementById('uploadFileName').textContent = file.name;
                document.getElementById('uploadStatus').textContent = 'Subiendo...';
                document.getElementById('uploadProgressFill').style.width = '30%';
            }
            
            try {
                const response = await fetch('/api/documents/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (docsProgress) {
                    document.getElementById('uploadStatus').textContent = 'Procesando...';
                    document.getElementById('uploadProgressFill').style.width = '60%';
                }
                
                const data = await response.json();
                
                if (docsProgress) {
                    document.getElementById('uploadProgressFill').style.width = '100%';
                }
                
                if (data.success) {
                    showToast(`✅ "${file.name}" procesado correctamente`, 'success');
                    await loadDocuments();
                } else {
                    throw new Error(data.error || 'Error al procesar');
                }
                
            } catch (error) {
                console.error('Error uploading:', error);
                showToast(`❌ Error al subir "${file.name}": ${error.message}`, 'error');
            } finally {
                setTimeout(() => {
                    if (docsProgress) {
                        docsProgress.style.display = 'none';
                        document.getElementById('uploadProgressFill').style.width = '0%';
                    }
                }, 1000);
            }
        }

        async function deleteDocument(documentId) {
            try {
                const response = await fetch(`/api/documents/${documentId}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast('Documento eliminado', 'success');
                    await loadDocuments();
                } else {
                    throw new Error(data.error || 'Error al eliminar');
                }
            } catch (error) {
                console.error('Error deleting:', error);
                showToast(`Error al eliminar: ${error.message}`, 'error');
            }
        }

        // ===== Docs Panel Toggle =====
        if (toggleDocsPanel) {
            toggleDocsPanel.addEventListener('click', () => {
                docsPanel.classList.toggle('open');
                if (docsPanel.classList.contains('open')) {
                    loadDocuments();
                }
            });
        }
        
        if (closePanelBtn) {
            closePanelBtn.addEventListener('click', () => {
                docsPanel.classList.remove('open');
            });
        }

        // ===== RAG Toggle =====
        if (ragToggle) {
            ragToggle.addEventListener('change', () => {
                useRAG = ragToggle.checked;
                console.log('🔄 RAG:', useRAG ? 'Activado' : 'Desactivado');
            });
        }

        // ===== File Upload via Drag & Drop =====
        if (docsUploadZone) {
            docsUploadZone.addEventListener('click', () => fileInput.click());
            
            docsUploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                docsUploadZone.classList.add('dragover');
            });
            
            docsUploadZone.addEventListener('dragleave', () => {
                docsUploadZone.classList.remove('dragover');
            });
            
            docsUploadZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                docsUploadZone.classList.remove('dragover');
                
                const files = Array.from(e.dataTransfer.files);
                for (const file of files) {
                    await uploadDocument(file);
                }
            });
        }

        // ===== File Input Handler =====
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                for (const file of files) {
                    await uploadDocument(file);
                }
                fileInput.value = '';
            });
        }

        // ===== Attach Button =====
        if (attachBtn) {
            attachBtn.addEventListener('click', () => {
                if (!isProcessing) {
                    // Open the docs panel when clicking attach
                    docsPanel.classList.add('open');
                    loadDocuments();
                }
            });
        }

        // ===== Sidebar collapse/expand =====
        if (collapseSidebar) {
            collapseSidebar.addEventListener('click', () => {
                chatApp.classList.add('collapsed');
            });
        }
        
        if (expandSidebar) {
            expandSidebar.addEventListener('click', () => {
                chatApp.classList.remove('collapsed');
            });
        }

        // ===== Navigation =====
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/pages/menu.html';
            });
        }

        // ===== New Chat =====
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                conversationHistory = [];
                chatMessages.innerHTML = '';
                chatMessages.appendChild(welcomeScreen);
                welcomeScreen.style.display = 'flex';
                if (chatInput) {
                    chatInput.value = '';
                    chatInput.style.height = 'auto';
                }
                if (sendBtn) sendBtn.disabled = true;
                console.log('🔄 Nueva conversación iniciada');
            });
        }

        // ===== Voice Recognition =====
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition && voiceBtn) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'es-ES';
            
            let finalTranscript = '';
            let interimTranscript = '';
            
            recognition.onstart = () => {
                isRecording = true;
                voiceBtn.classList.add('recording');
                if (chatInput) {
                    chatInput.placeholder = '🎤 Escuchando...';
                }
            };
            
            recognition.onresult = (event) => {
                interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                if (chatInput) {
                    chatInput.value = finalTranscript + interimTranscript;
                    chatInput.dispatchEvent(new Event('input'));
                }
            };
            
            recognition.onerror = (event) => {
                console.error('🎤 Error:', event.error);
                stopRecording();
            };
            
            recognition.onend = () => {
                stopRecording();
            };
            
            function stopRecording() {
                isRecording = false;
                voiceBtn.classList.remove('recording');
                if (chatInput) {
                    chatInput.placeholder = 'Escribe tu consulta...';
                    chatInput.focus();
                }
                finalTranscript = '';
                interimTranscript = '';
            }
            
            voiceBtn.addEventListener('click', () => {
                if (isProcessing) return;
                
                if (isRecording) {
                    recognition.stop();
                } else {
                    finalTranscript = chatInput.value || '';
                    interimTranscript = '';
                    try {
                        recognition.start();
                    } catch (e) {
                        console.error('Error:', e);
                    }
                }
            });
            
        } else if (voiceBtn) {
            voiceBtn.classList.add('not-supported');
            voiceBtn.title = 'Tu navegador no soporta reconocimiento de voz';
        }

        // ===== Model Selector =====
        if (modelBtn && modelSelector) {
            modelBtn.addEventListener('click', (e) => {
                if (isProcessing) return;
                e.stopPropagation();
                modelSelector.classList.toggle('open');
            });
            
            document.addEventListener('click', (e) => {
                if (!modelSelector.contains(e.target)) {
                    modelSelector.classList.remove('open');
                }
            });
        }

        modelItems.forEach(item => {
            item.addEventListener('click', () => {
                if (isProcessing) return;
                
                modelItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                const selectedModel = item.dataset.model;
                const isPro = selectedModel === 'deepseek-reasoner';
                
                currentModel = isPro ? 'copilot-pro' : 'copilot';
                
                if (modelBtnText) {
                    modelBtnText.textContent = isPro ? 'Copilot Pro' : 'Copilot';
                }
                
                if (currentModelDisplay) {
                    currentModelDisplay.textContent = isPro ? 'Perxia Copilot Pro' : 'Perxia Copilot';
                }
                
                if (chatApp) {
                    chatApp.classList.toggle('pro-mode', isPro);
                }
                
                modelSelector.classList.remove('open');
                console.log('🤖 Modelo:', currentModel);
            });
        });

        // ===== Suggestion Buttons =====
        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (isProcessing) return;
                
                const prompt = btn.dataset.prompt;
                if (prompt && chatInput) {
                    chatInput.value = prompt;
                    chatInput.dispatchEvent(new Event('input'));
                    chatInput.focus();
                }
            });
        });

        // ===== Chat Input =====
        if (chatInput) {
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
                if (sendBtn && !isProcessing) {
                    sendBtn.disabled = !chatInput.value.trim();
                }
            });

            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (chatInput.value.trim() && !isProcessing) {
                        chatForm.dispatchEvent(new Event('submit'));
                    }
                }
            });
        }

        // ===== Form Submit - Main Chat Logic with RAG =====
        if (chatForm) {
            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (isProcessing) {
                    console.log('⏳ Ya hay una solicitud en proceso');
                    return;
                }
                
                const message = chatInput.value.trim();
                if (!message) return;

                if (welcomeScreen) welcomeScreen.style.display = 'none';
                
                addMessage(message, 'user', account?.name || 'Usuario');
                
                conversationHistory.push({
                    role: 'user',
                    content: message
                });
                
                chatInput.value = '';
                chatInput.style.height = 'auto';
                
                lockUI();

                const typingIndicator = showTypingIndicator();

                try {
                    const apiEndpoint = currentModel === 'copilot-pro' 
                        ? '/api/copilot-pro/chat' 
                        : '/api/copilot/chat';
                    
                    console.log(`📤 Enviando a ${apiEndpoint} (RAG: ${useRAG})...`);
                    
                    const response = await fetch(apiEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            messages: conversationHistory,
                            temperature: currentModel === 'copilot-pro' ? 0.5 : 0.7,
                            max_tokens: currentModel === 'copilot-pro' ? 8192 : 4096,
                            useRAG: useRAG
                        })
                    });
                    
                    const data = await response.json();
                    
                    typingIndicator.remove();
                    
                    if (data.success && data.content) {
                        const modelName = currentModel === 'copilot-pro' ? 'Perxia Pro' : 'Perxia';
                        
                        // Show which documents were used
                        let ragInfo = '';
                        if (data.ragUsed && data.documentsUsed && data.documentsUsed.length > 0) {
                            ragInfo = data.documentsUsed.map(d => d.filename).join(', ');
                        }
                        
                        addMessage(data.content, 'assistant', modelName, data.mock, ragInfo);
                        
                        conversationHistory.push({
                            role: 'assistant',
                            content: data.content
                        });
                        
                        console.log(`📥 Respuesta (mock: ${data.mock}, RAG docs: ${data.documentsUsed?.length || 0})`);
                    } else {
                        throw new Error(data.message || 'Error al obtener respuesta');
                    }
                    
                } catch (error) {
                    console.error('❌ Error:', error);
                    typingIndicator.remove();
                    
                    addMessage(
                        `Lo siento, hubo un error: ${error.message}. Por favor intenta de nuevo.`,
                        'assistant',
                        'Perxia',
                        true
                    );
                } finally {
                    unlockUI();
                }
            });
        }

        // ===== Add Message to Chat =====
        function addMessage(content, type, userName = 'Perxia', isMock = false, ragInfo = '') {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}`;
            
            const initials = type === 'user' 
                ? userName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2)
                : 'P';

            const formattedContent = formatMessage(content);
            
            const ragBadge = ragInfo ? `<span class="rag-badge" title="Basado en: ${ragInfo}">📄 Documentos usados</span>` : '';

            messageDiv.innerHTML = `
                <div class="message-avatar">${initials}</div>
                <div class="message-content">
                    <div class="message-bubble${isMock ? ' mock-response' : ''}">
                        ${formattedContent}
                    </div>
                    <div class="message-footer">
                        ${ragBadge}
                        <span class="message-time">${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            `;

            chatMessages.appendChild(messageDiv);
            
            setTimeout(() => {
                chatMessages.scrollTo({
                    top: chatMessages.scrollHeight,
                    behavior: 'smooth'
                });
            }, 100);
        }

        // ===== Format Message (Markdown-like) =====
        function formatMessage(content) {
            return content
                .replace(/^### (.*$)/gim, '<h4>$1</h4>')
                .replace(/^## (.*$)/gim, '<h3>$1</h3>')
                .replace(/^# (.*$)/gim, '<h2>$1</h2>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
                .replace(/^[-•] (.*$)/gim, '<li>$1</li>')
                .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
                .replace(/^---$/gim, '<hr>')
                .replace(/\n/g, '<br>')
                .replace(/✅|✓|❌|⭐|🎯|📋|📊|🔍|🧠|💡|📈|🚀|⚠️|📄|💬|🤔|📝/g, match => `<span class="emoji">${match}</span>`);
        }

        // ===== Show Typing Indicator =====
        function showTypingIndicator() {
            const div = document.createElement('div');
            div.className = 'message assistant typing-indicator-message';
            div.innerHTML = `
                <div class="message-avatar">P</div>
                <div class="message-content">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            `;
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return div;
        }

        // ===== Initialize =====
        // Try to initialize the search index
        try {
            await fetch('/api/documents/init-index', { method: 'POST' });
            console.log('🔍 Índice de búsqueda inicializado');
        } catch (e) {
            console.log('⚠️ No se pudo inicializar el índice (puede que ya exista)');
        }
        
        // Load existing documents
        await loadDocuments();

        console.log('✅ Chatbot con RAG inicializado correctamente');

    } catch (error) {
        console.error('Error inicializando chatbot:', error);
    }
});
