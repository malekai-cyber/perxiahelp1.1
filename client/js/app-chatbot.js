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
        const purgeAllBtn = document.getElementById('purgeAllBtn');
        const toastContainer = document.getElementById('toastContainer');
        
        // Hub panel elements
        const hubPanel = document.getElementById('hubPanel');
        const hubBackBtn = document.getElementById('hubBackBtn');
        const hubTitle = document.getElementById('hubTitle');
        const hubSubtitle = document.getElementById('hubSubtitle');
        const hubGrid = document.getElementById('hubGrid');
        const hubAskBtn = document.getElementById('hubAskBtn');
        const hubCapabilityItems = document.querySelectorAll('.capability-item.clickable');
        const filterChips = document.querySelectorAll('.filter-chip');
        
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
            
            // Show/hide purge button based on document count
            if (purgeAllBtn) {
                purgeAllBtn.style.display = uploadedDocuments.length > 0 ? 'inline-block' : 'none';
            }
            
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
                // Mostrar indicador de eliminación
                showToast('Eliminando documento...', 'info');
                
                const response = await fetch(`/api/documents/${documentId}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    const details = data.details || {};
                    const chunksDeleted = details.chunksDeleted || 0;
                    const filename = details.filename || 'documento';
                    
                    showToast(`"${filename}" eliminado (${chunksDeleted} fragmentos)`, 'success');
                    
                    // Esperar un momento y recargar la lista
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await loadDocuments();
                    
                    // Verificar que se eliminó de la lista
                    const stillExists = uploadedDocuments.some(d => d.documentId === documentId);
                    if (stillExists) {
                        console.warn('⚠️ Document still in list after delete, refreshing...');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await loadDocuments();
                    }
                } else {
                    throw new Error(data.error || 'Error al eliminar');
                }
            } catch (error) {
                console.error('Error deleting:', error);
                showToast(`Error al eliminar: ${error.message}`, 'error');
            }
        }

        async function purgeAllDocuments() {
            try {
                showToast('Eliminando todos los documentos...', 'info');
                
                const response = await fetch('/api/documents/purge-all', {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    const details = data.details || {};
                    showToast(`Eliminados ${details.documentsProcessed || 0} documentos (${details.chunksDeleted || 0} fragmentos)`, 'success');
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await loadDocuments();
                } else {
                    throw new Error(data.error || 'Error al purgar');
                }
            } catch (error) {
                console.error('Error purging:', error);
                showToast(`Error: ${error.message}`, 'error');
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

        // ===== Purge All Documents =====
        if (purgeAllBtn) {
            purgeAllBtn.addEventListener('click', async () => {
                if (confirm('⚠️ ¿Eliminar TODOS los documentos?\n\nEsta acción no se puede deshacer.')) {
                    await purgeAllDocuments();
                }
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
        
        // ===== Hub Panel (Periferia IT Hub) =====
        const hubConfig = {
            casos: {
                title: '🏆 Casos de Éxito',
                subtitle: 'Explora los proyectos exitosos de Periferia IT',
                filters: ['Todos', 'Azure', 'IA/ML', 'Data', 'Cloud'],
                category: 'casos',
                showSearch: false
            },
            pocs: {
                title: '🔬 PoCs & PoVs',
                subtitle: 'Pruebas de concepto y validaciones técnicas',
                filters: ['Todos', 'En progreso', 'Completados', 'Azure AI', 'Otros'],
                category: 'pocs',
                showSearch: false
            },
            tools: {
                title: '🔍 Explorador de Conocimiento',
                subtitle: 'Busca en todos los casos, PoCs y documentos de Periferia IT',
                filters: [], // Sin filtros predefinidos, usa búsqueda
                category: 'all', // Mostrar todo
                showSearch: true // Habilitar campo de búsqueda
            }
        };
        
        let currentHubView = null;
        let currentHubItems = []; // Cache de items para filtrar
        
        // Cargar estadísticas del Hub para badges del sidebar
        async function loadHubStats() {
            try {
                const response = await fetch('/api/hub/stats');
                const data = await response.json();
                
                if (data.success && data.stats) {
                    // Actualizar badges en el sidebar
                    const badges = {
                        casos: data.stats.casos || 0,
                        pocs: data.stats.pocs || 0,
                        tools: data.stats.total || 0 // En tools mostramos el total
                    };
                    
                    hubCapabilityItems.forEach(item => {
                        const view = item.dataset.view;
                        const badge = item.querySelector('.item-badge');
                        if (badge && badges[view] !== undefined) {
                            badge.textContent = badges[view];
                        }
                    });
                    
                    console.log('📊 Hub stats cargadas:', badges);
                }
            } catch (error) {
                console.log('⚠️ No se pudieron cargar las estadísticas del Hub');
            }
        }
        
        async function loadHubItems(category = 'all') {
            try {
                const response = await fetch(`/api/hub/items?category=${category}&top=20`);
                const data = await response.json();
                return data.success ? data.items : [];
            } catch (error) {
                console.error('Error cargando items del Hub:', error);
                return [];
            }
        }
        
        // Cargar tags disponibles para filtros dinámicos
        async function loadHubTags(category) {
            try {
                const url = category ? `/api/hub/tags?category=${category}` : '/api/hub/tags';
                const response = await fetch(url);
                const data = await response.json();
                return data.tags || [];
            } catch (error) {
                console.error('Error cargando tags:', error);
                return [];
            }
        }
        
        function renderHubCards(items) {
            if (!hubGrid) return;
            
            if (items.length === 0) {
                hubGrid.innerHTML = `
                    <div class="hub-empty">
                        <p>No se encontraron items en esta categoría.</p>
                        <p>Intenta con otra búsqueda o pregúntame directamente.</p>
                    </div>
                `;
                return;
            }
            
            // Mapear campos del índice a la UI - usar campos enriquecidos
            hubGrid.innerHTML = items.map(item => {
                // Usar campos enriquecidos primero, luego los originales
                const title = item.enrichedTitle || item.titulo || item.title || item.nombre || 'Sin título';
                const description = item.enrichedDescription || item.descripcion || item.description || '';
                const itemType = item.enrichedType || item.tipo || item.type || '';
                const tags = item.enrichedTags || item.tags || [];
                const icon = getHubIcon(itemType);
                
                // Formatear el tipo para mostrar
                const typeLabel = formatTypeLabel(itemType);
                
                // Truncar descripción
                const shortDesc = description.length > 150 ? description.substring(0, 150) + '...' : description;
                
                // Renderizar tags (máximo 4)
                const tagsArray = Array.isArray(tags) ? tags : [];
                const tagsHtml = tagsArray.slice(0, 4).map(t => `<span class="tag">${t}</span>`).join('');
                
                return `
                    <div class="hub-card" data-id="${item.id || ''}" data-type="${itemType}" data-tags="${tagsArray.join(',')}">
                        <div class="hub-card-header">
                            <span class="hub-card-icon">${icon}</span>
                            <span class="hub-card-type">${typeLabel}</span>
                        </div>
                        <div class="hub-card-content">
                            <h3>${title}</h3>
                            <p>${shortDesc}</p>
                            ${tagsHtml ? `<div class="hub-card-tags">${tagsHtml}</div>` : ''}
                        </div>
                        <button class="hub-card-action" data-prompt="Dame más información sobre: ${title}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            Preguntar
                        </button>
                    </div>
                `;
            }).join('');
            
            // Attach event listeners a los botones de acción
            document.querySelectorAll('.hub-card-action').forEach(btn => {
                btn.addEventListener('click', () => {
                    const prompt = btn.dataset.prompt;
                    if (prompt && chatInput) {
                        hideHubPanel();
                        chatInput.value = prompt;
                        chatInput.dispatchEvent(new Event('input'));
                        chatForm.dispatchEvent(new Event('submit'));
                    }
                });
            });
        }
        
        // Formatear etiqueta de tipo
        function formatTypeLabel(type) {
            const labels = {
                'caso_exito': 'Caso de Éxito',
                'poc': 'PoC',
                'pov': 'PoV',
                'herramienta': 'Herramienta',
                'otros': 'Documento'
            };
            return labels[type] || 'Documento';
        }
        
        function getHubIcon(category) {
            const cat = (category || '').toLowerCase();
            if (cat.includes('caso') || cat.includes('exito')) return '🏆';
            if (cat.includes('poc')) return '🔬';
            if (cat.includes('pov')) return '📊';
            if (cat.includes('herramienta') || cat.includes('tool')) return '🛠️';
            if (cat.includes('azure')) return '☁️';
            if (cat.includes('ia') || cat.includes('ai')) return '🤖';
            if (cat.includes('data')) return '📊';
            return '📋';
        }
        
        // Capitalizar primera letra
        function capitalizeTag(tag) {
            const labelMap = {
                'azure': 'Azure',
                'ai': 'IA/ML',
                'data': 'Data',
                'cloud': 'Cloud',
                'devops': 'DevOps',
                'web': 'Web',
                'mobile': 'Mobile',
                'iot': 'IoT',
                'security': 'Seguridad',
                'database': 'Base de Datos',
                'automation': 'Automatización',
                'finanzas': 'Finanzas',
                'retail': 'Retail',
                'salud': 'Salud',
                'educación': 'Educación',
                'gobierno': 'Gobierno',
                'manufactura': 'Manufactura'
            };
            return labelMap[tag] || tag.charAt(0).toUpperCase() + tag.slice(1);
        }
        
        async function showHubPanel(view) {
            const config = hubConfig[view];
            if (!config) return;
            
            currentHubView = view;
            
            // Update hub content
            if (hubTitle) hubTitle.textContent = config.title;
            if (hubSubtitle) hubSubtitle.textContent = config.subtitle;
            
            // Mostrar/ocultar barra de búsqueda según la vista
            const hubSearchContainer = document.getElementById('hubSearchContainer');
            if (hubSearchContainer) {
                hubSearchContainer.style.display = config.showSearch ? 'flex' : 'none';
                // Limpiar búsqueda al cambiar de vista
                const hubSearchInput = document.getElementById('hubSearchInput');
                if (hubSearchInput) hubSearchInput.value = '';
            }
            
            // Mostrar loading mientras carga
            if (hubGrid) {
                hubGrid.innerHTML = `
                    <div class="hub-loading">
                        <div class="loading-spinner"></div>
                        <p>Cargando...</p>
                    </div>
                `;
            }
            
            // Cargar items primero
            const items = await loadHubItems(config.category);
            currentHubItems = items; // Guardar en cache para búsqueda
            
            // Generar filtros dinámicos basados en los tags de los items cargados
            const hubFiltersEl = document.getElementById('hubFilters');
            if (hubFiltersEl) {
                if (config.showSearch) {
                    // Para la vista de búsqueda, mostrar filtros por tipo
                    hubFiltersEl.innerHTML = `
                        <button class="filter-chip active" data-filter="all">Todos</button>
                        <button class="filter-chip" data-filter="caso_exito">🏆 Casos de Éxito</button>
                        <button class="filter-chip" data-filter="poc">🔬 PoCs</button>
                        <button class="filter-chip" data-filter="pov">📊 PoVs</button>
                    `;
                } else {
                    // Recopilar todos los tags únicos de los items
                    const tagCounts = {};
                    items.forEach(item => {
                        (item.enrichedTags || []).forEach(tag => {
                            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                        });
                    });
                    
                    // Ordenar por frecuencia y tomar los top 6
                    const topTags = Object.entries(tagCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 6)
                        .map(([tag]) => tag);
                    
                    // Crear filtros: Todos + tags dinámicos
                    const filters = ['Todos', ...topTags];
                    hubFiltersEl.innerHTML = filters.map((f, i) => {
                        const filterValue = f === 'Todos' ? 'all' : f.toLowerCase();
                        const displayLabel = f === 'Todos' ? 'Todos' : capitalizeTag(f);
                        return `<button class="filter-chip${i === 0 ? ' active' : ''}" data-filter="${filterValue}">${displayLabel}</button>`;
                    }).join('');
                }
                
                // Re-attach filter event listeners
                document.querySelectorAll('.filter-chip').forEach(chip => {
                    chip.addEventListener('click', async () => {
                        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                        chip.classList.add('active');
                        
                        const filter = chip.dataset.filter;
                        if (filter === 'all') {
                            renderHubCards(currentHubItems);
                        } else if (['caso_exito', 'poc', 'pov', 'herramienta'].includes(filter)) {
                            // Filtrar por tipo
                            const filtered = currentHubItems.filter(item => item.enrichedType === filter);
                            renderHubCards(filtered);
                        } else {
                            // Filtrar por tag
                            const filtered = currentHubItems.filter(item => {
                                const itemTags = item.enrichedTags || [];
                                return itemTags.includes(filter);
                            });
                            renderHubCards(filtered);
                        }
                    });
                });
            }
            
            // Update active state in sidebar
            hubCapabilityItems.forEach(item => {
                item.classList.toggle('active', item.dataset.view === view);
            });
            
            // Agregar clase hub-active al contenedor principal para ocultar mensajes
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer) chatContainer.classList.add('hub-active');
            
            // Show hub panel
            if (hubPanel) hubPanel.style.display = 'flex';
            
            // Renderizar los items ya cargados
            renderHubCards(items);
        }
        
        // Función de búsqueda en el Hub
        async function searchHub(query) {
            if (!query || query.trim().length < 2) {
                renderHubCards(currentHubItems);
                return;
            }
            
            try {
                const response = await fetch(`/api/hub/search?q=${encodeURIComponent(query)}&top=50`);
                const data = await response.json();
                
                if (data.success && data.items) {
                    renderHubCards(data.items);
                } else {
                    renderHubCards([]);
                }
            } catch (error) {
                console.error('Error buscando en Hub:', error);
                // Fallback: búsqueda local
                const queryLower = query.toLowerCase();
                const filtered = currentHubItems.filter(item => {
                    const title = (item.enrichedTitle || '').toLowerCase();
                    const desc = (item.enrichedDescription || '').toLowerCase();
                    const tags = (item.enrichedTags || []).join(' ').toLowerCase();
                    return title.includes(queryLower) || desc.includes(queryLower) || tags.includes(queryLower);
                });
                renderHubCards(filtered);
            }
        }
        
        // Event listener para el buscador del Hub
        const hubSearchInput = document.getElementById('hubSearchInput');
        if (hubSearchInput) {
            let searchTimeout;
            hubSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchHub(e.target.value);
                }, 300); // Debounce de 300ms
            });
        }
        
        function hideHubPanel() {
            // Quitar clase hub-active para mostrar el chat de nuevo
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer) chatContainer.classList.remove('hub-active');
            
            // Ocultar panel hub
            if (hubPanel) hubPanel.style.display = 'none';
            hubCapabilityItems.forEach(item => item.classList.remove('active'));
        }
        
        // Hub capability items click handlers
        hubCapabilityItems.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                showHubPanel(view);
            });
        });
        
        // Hub back button
        if (hubBackBtn) {
            hubBackBtn.addEventListener('click', () => {
                hideHubPanel();
                // Mostrar welcome screen si no hay mensajes previos
                const messagesWrapper = document.getElementById('chatMessages');
                const hasMessages = messagesWrapper && messagesWrapper.querySelector('.message');
                if (welcomeScreen && !hasMessages) {
                    welcomeScreen.style.display = 'flex';
                }
            });
        }
        
        // Hub "Ask directly" button
        if (hubAskBtn) {
            hubAskBtn.addEventListener('click', () => {
                hideHubPanel();
                if (welcomeScreen && !document.querySelector('.message')) {
                    welcomeScreen.style.display = 'flex';
                }
                if (chatInput) chatInput.focus();
            });
        }

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

                // Si el Hub está abierto, cerrarlo y volver al chat
                hideHubPanel();
                
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
                    
                    // Si hay thinking en Copilot Pro, mostrarlo mientras "piensa"
                    if (data.success && data.content && currentModel === 'copilot-pro') {
                        const parsed = parseThinkingContent(data.content);
                        if (parsed.thinking) {
                            // Mostrar el razonamiento de forma animada
                            await showThinkingAnimation(typingIndicator, parsed.thinking);
                        }
                    }
                    
                    typingIndicator.remove();
                    
                    if (data.success && data.content) {
                        const modelName = currentModel === 'copilot-pro' ? 'Perxia Pro' : 'Perxia';
                        
                        // Show which documents were used
                        let ragInfo = '';
                        if (data.ragUsed && data.documentsUsed && data.documentsUsed.length > 0) {
                            ragInfo = data.documentsUsed.map(d => d.filename).join(', ');
                        }
                        
                        // Usar streaming para la respuesta (ya sin thinking)
                        await addMessageWithStreaming(data.content, 'assistant', modelName, data.mock, ragInfo);
                        
                        // Guardar en historial (sin las etiquetas think)
                        const cleanContent = data.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                        conversationHistory.push({
                            role: 'assistant',
                            content: cleanContent
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
        function addMessage(content, type, userName = 'Perxia', isMock = false, ragInfo = '', options = {}) {
            const messageDiv = document.createElement('div');
            // Agregar clase del modelo actual
            const modelClass = currentModel === 'copilot-pro' ? 'copilot-pro' : 'copilot';
            messageDiv.className = `message ${type} ${modelClass}`;
            
            const initials = type === 'user' 
                ? userName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2)
                : (currentModel === 'copilot-pro' ? '✨' : 'P');

            const modelBadge = type === 'assistant' 
                ? `<span class="message-model-badge">${currentModel === 'copilot-pro' ? '⭐ Pro' : '🤖 Copilot'}</span>`
                : '';
            
            const ragBadge = ragInfo ? `<span class="rag-badge" title="Basado en: ${ragInfo}">📄 Documentos usados</span>` : '';

            // Siempre limpiar el thinking del contenido final
            let displayContent = content;
            if (type === 'assistant') {
                const parsed = parseThinkingContent(content);
                displayContent = parsed.response;
            }

            // Si es streaming, crear contenedor vacío
            if (options.streaming) {
                messageDiv.innerHTML = `
                    <div class="message-avatar">${initials}</div>
                    <div class="message-content">
                        <div class="message-bubble${isMock ? ' mock-response' : ''}">
                            <div class="streaming-text" id="${options.streamId}"></div>
                            <span class="streaming-cursor"></span>
                        </div>
                        <div class="message-footer">
                            ${modelBadge}
                            ${ragBadge}
                            <span class="message-time">${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                `;
            } else {
                const formattedContent = formatMessage(displayContent);

                messageDiv.innerHTML = `
                    <div class="message-avatar">${initials}</div>
                    <div class="message-content">
                        <div class="message-bubble${isMock ? ' mock-response' : ''}">
                            ${formattedContent}
                        </div>
                        <div class="message-footer">
                            ${modelBadge}
                            ${ragBadge}
                            <span class="message-time">${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                `;
            }

            chatMessages.appendChild(messageDiv);
            
            setTimeout(() => {
                const container = document.getElementById('chatContainer');
                if (container) {
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            }, 100);
            
            return messageDiv;
        }

        // ===== Parse Thinking Content (para Copilot Pro) =====
        function parseThinkingContent(content) {
            const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
            if (thinkMatch) {
                const thinking = thinkMatch[1].trim();
                const response = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                return { thinking, response };
            }
            return { thinking: null, response: content };
        }

        // ===== Streaming Text Effect =====
        async function streamText(elementId, text, speed = 15) {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const cursor = element.parentElement.querySelector('.streaming-cursor');
            let index = 0;
            
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    if (index < text.length) {
                        // Agregar caracteres de a poco
                        const char = text[index];
                        element.innerHTML = formatMessage(text.substring(0, index + 1));
                        index++;
                        
                        // Scroll automático
                        const container = document.getElementById('chatContainer');
                        if (container) {
                            container.scrollTop = container.scrollHeight;
                        }
                    } else {
                        clearInterval(interval);
                        // Remover cursor
                        if (cursor) cursor.remove();
                        resolve();
                    }
                }, speed);
            });
        }

        // ===== Add Message with Streaming Effect =====
        async function addMessageWithStreaming(content, type, userName = 'Perxia', isMock = false, ragInfo = '') {
            const streamId = 'stream-' + Date.now();
            
            // Para Copilot Pro, parsear el thinking primero
            let displayContent = content;
            
            if (type === 'assistant') {
                const parsed = parseThinkingContent(content);
                displayContent = parsed.response;
            }
            
            // Crear mensaje con streaming
            const messageDiv = addMessage('', type, userName, isMock, ragInfo, { streaming: true, streamId });
            
            const streamContainer = document.getElementById(streamId);
            if (!streamContainer) return;
            
            // Stream del contenido principal (sin thinking)
            await streamText(streamId, displayContent, currentModel === 'copilot-pro' ? 10 : 15);
            
            // Actualizar modelo badge
            const modelBadge = currentModel === 'copilot-pro' 
                ? '<span class="message-model-badge">⭐ Pro</span>'
                : '<span class="message-model-badge">🤖 Copilot</span>';
            
            const footer = messageDiv.querySelector('.message-footer');
            if (footer && !footer.querySelector('.message-model-badge')) {
                footer.insertAdjacentHTML('afterbegin', modelBadge);
            }
            
            return messageDiv;
        }

        // ===== Format Message (Markdown-like) =====
        function formatMessage(content) {
            if (!content) return '';
            
            // Primero, limpiar etiquetas think si quedaron
            let formatted = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            
            // Limpiar emojis problemáticos que se muestran como ??
            formatted = formatted.replace(/\uFFFD/g, '');
            formatted = formatted.replace(/\?{2,}/g, '');
            
            // Proteger bloques de código
            const codeBlocks = [];
            formatted = formatted.replace(/```([\s\S]*?)```/g, (match, code) => {
                codeBlocks.push(code);
                return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
            });
            
            // ===== TABLAS MARKDOWN (procesar antes de otras cosas) =====
            formatted = parseMarkdownTables(formatted);
            
            // Headers - procesar en orden de mayor a menor
            formatted = formatted.replace(/^#{4,}\s*(.+)$/gm, '<h4 class="chat-heading">$1</h4>');
            formatted = formatted.replace(/^###\s*(.+)$/gm, '<h4 class="chat-heading">$1</h4>');
            formatted = formatted.replace(/^##\s*(.+)$/gm, '<h3 class="chat-heading">$1</h3>');
            formatted = formatted.replace(/^#\s*(.+)$/gm, '<h2 class="chat-heading">$1</h2>');
            
            // Bold y italic
            formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            
            // Código inline
            formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
            
            // Blockquotes
            formatted = formatted.replace(/^>\s*(.+)$/gm, '<blockquote class="chat-quote">$1</blockquote>');
            
            // Limpiar líneas que son solo guiones o pipes (residuos de tablas)
            formatted = formatted.replace(/^\|[-\s|]+\|$/gm, '');
            formatted = formatted.replace(/^-{2,}$/gm, '');
            
            // Listas con bullets (requiere espacio después del guión)
            formatted = formatted.replace(/^[-•]\s+(.+)$/gm, '<li class="chat-list-item">$1</li>');
            
            // Listas numeradas
            formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, '<li class="chat-list-item chat-list-numbered"><span class="list-number">$1.</span> $2</li>');
            
            // HR (exactamente 3 guiones)
            formatted = formatted.replace(/^---$/gm, '<hr class="chat-divider">');
            
            // Restaurar bloques de código
            codeBlocks.forEach((code, i) => {
                formatted = formatted.replace(
                    `__CODE_BLOCK_${i}__`, 
                    `<pre class="chat-code-block"><code>${code.trim()}</code></pre>`
                );
            });
            
            // Line breaks
            formatted = formatted.replace(/\n/g, '<br>');
            
            // Limpiar br extras después de elementos de bloque
            formatted = formatted.replace(/(<\/h[234]>)<br>/g, '$1');
            formatted = formatted.replace(/(<\/li>)<br>/g, '$1');
            formatted = formatted.replace(/(<\/blockquote>)<br>/g, '$1');
            formatted = formatted.replace(/(<\/pre>)<br>/g, '$1');
            formatted = formatted.replace(/(<\/table>)<br>/g, '$1');
            formatted = formatted.replace(/<br><br><br>/g, '<br><br>');
            formatted = formatted.replace(/<br>--<br>/g, '<br>');
            
            return formatted;
        }

        // ===== Parse Markdown Tables =====
        function parseMarkdownTables(text) {
            const lines = text.split('\n');
            let result = [];
            let tableLines = [];
            let inTable = false;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Detectar inicio de tabla (línea con | al inicio y final)
                if (line.startsWith('|') && line.endsWith('|')) {
                    inTable = true;
                    tableLines.push(line);
                } else if (inTable) {
                    // Fin de la tabla
                    if (tableLines.length >= 2) {
                        result.push(convertTableToHtml(tableLines));
                    } else {
                        result.push(...tableLines);
                    }
                    tableLines = [];
                    inTable = false;
                    result.push(lines[i]);
                } else {
                    result.push(lines[i]);
                }
            }
            
            // Si terminamos dentro de una tabla
            if (tableLines.length >= 2) {
                result.push(convertTableToHtml(tableLines));
            } else if (tableLines.length > 0) {
                result.push(...tableLines);
            }
            
            return result.join('\n');
        }
        
        // ===== Convert Table Lines to HTML =====
        function convertTableToHtml(tableLines) {
            let html = '<div class="table-container"><table class="chat-table">';
            let headerDone = false;
            
            for (const line of tableLines) {
                // Saltar líneas separadoras (|---|---|)
                if (/^\|[\s\-:|]+\|$/.test(line)) {
                    headerDone = true;
                    continue;
                }
                
                // Parsear celdas
                const cells = line.split('|').slice(1, -1); // Quitar primer y último vacío
                
                if (cells.length > 0) {
                    html += '<tr>';
                    const tag = !headerDone ? 'th' : 'td';
                    for (const cell of cells) {
                        const cellContent = cell.trim();
                        html += `<${tag}>${cellContent}</${tag}>`;
                    }
                    html += '</tr>';
                }
            }
            
            html += '</table></div>';
            return html;
        }

        // ===== Parse Markdown Tables OLD (backup) =====
        function parseMarkdownTablesOld(text) {
            // Buscar patrones de tabla: líneas que empiezan y terminan con |
            const tableRegex = /(\|[^\n]+\|\n)+/g;
            
            return text.replace(tableRegex, (match) => {
                const lines = match.trim().split('\n').filter(line => line.trim());
                if (lines.length < 2) return match;
                
                // Verificar si es una tabla válida (tiene separador con ---)
                const hasSeparator = lines.some(line => /^\|[\s\-:|]+\|$/.test(line.trim()));
                if (!hasSeparator) return match;
                
                let html = '<table class="chat-table">';
                let isHeader = true;
                
                for (const line of lines) {
                    // Saltar líneas separadoras
                    if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
                        isHeader = false;
                        continue;
                    }
                    
                    // Parsear celdas
                    const cells = line.split('|').filter((cell, i, arr) => i > 0 && i < arr.length - 1);
                    
                    if (cells.length > 0) {
                        html += '<tr>';
                        const tag = isHeader ? 'th' : 'td';
                        for (const cell of cells) {
                            html += `<${tag}>${cell.trim()}</${tag}>`;
                        }
                        html += '</tr>';
                    }
                }
                
                html += '</table>';
                return html;
            });
        }

        // ===== Show Typing Indicator =====
        function showTypingIndicator() {
            const div = document.createElement('div');
            const modelClass = currentModel === 'copilot-pro' ? 'copilot-pro' : 'copilot';
            const avatar = currentModel === 'copilot-pro' ? '✨' : 'P';
            div.className = `message assistant ${modelClass} typing-indicator-message`;
            div.id = 'typing-indicator-active';
            div.innerHTML = `
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">
                    <div class="typing-bubble">
                        <div class="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <div class="thinking-preview" style="display: none;">
                            <span class="thinking-preview-icon">🧠</span>
                            <span class="thinking-preview-text"></span>
                        </div>
                    </div>
                </div>
            `;
            chatMessages.appendChild(div);
            const container = document.getElementById('chatContainer');
            if (container) container.scrollTop = container.scrollHeight;
            return div;
        }

        // ===== Show Thinking Animation =====
        async function showThinkingAnimation(indicatorElement, thinkingText) {
            if (!indicatorElement) return;
            
            const contentDiv = indicatorElement.querySelector('.message-content');
            if (!contentDiv) return;
            
            // Animación más ligera y fluida
            contentDiv.innerHTML = `
                <div class="thinking-anim-box">
                    <div class="thinking-anim-header">
                        <div class="thinking-anim-icon">
                            <span class="brain-icon">🧠</span>
                            <span class="sparkle">✨</span>
                        </div>
                        <span class="thinking-anim-status">Pensando</span>
                    </div>
                    <div class="thinking-anim-text"></div>
                </div>
            `;
            
            const thinkingTextEl = contentDiv.querySelector('.thinking-anim-text');
            const statusEl = contentDiv.querySelector('.thinking-anim-status');
            
            // Limpiar el texto
            const cleanThinking = thinkingText
                .replace(/\n+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            // Mostrar palabras clave del pensamiento de forma fluida
            const words = cleanThinking.split(' ').slice(0, 15);
            let displayText = '';
            
            // Efecto de escritura rápido
            for (let i = 0; i < Math.min(words.length, 10); i++) {
                displayText += words[i] + ' ';
                thinkingTextEl.textContent = displayText + (i < 9 ? '...' : '');
                await new Promise(r => setTimeout(r, 80));
            }
            
            // Cambiar estado
            statusEl.textContent = 'Preparando respuesta...';
            await new Promise(r => setTimeout(r, 400));
            
            // Scroll
            const container = document.getElementById('chatContainer');
            if (container) container.scrollTop = container.scrollHeight;
        }

        // ===== Show Thinking in Typing Indicator (legacy) =====
        function showThinkingInIndicator(thinkingText) {
            const indicator = document.getElementById('typing-indicator-active');
            if (!indicator) return;
            
            const preview = indicator.querySelector('.thinking-preview');
            const previewText = indicator.querySelector('.thinking-preview-text');
            const dots = indicator.querySelector('.typing-indicator');
            
            if (preview && previewText) {
                // Mostrar el pensamiento resumido
                const shortThinking = thinkingText.length > 100 
                    ? thinkingText.substring(0, 100) + '...' 
                    : thinkingText;
                previewText.textContent = shortThinking;
                preview.style.display = 'flex';
                
                // Mantener los puntos pero más pequeños
                if (dots) {
                    dots.classList.add('thinking-mode');
                }
            }
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
        
        // Load Hub stats for sidebar badges
        await loadHubStats();

        console.log('✅ Chatbot con RAG inicializado correctamente');

    } catch (error) {
        console.error('Error inicializando chatbot:', error);
    }
});
