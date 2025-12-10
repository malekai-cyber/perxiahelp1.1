// PERXIA HELP - CHATBOT JS
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('📄 Inicializando Chatbot...');

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

        // DOM Elements
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
        const docsPanel = document.getElementById('docsPanel');
        const toggleDocsPanel = document.getElementById('toggleDocsPanel');
        const closePanelBtn = document.getElementById('closePanelBtn');
        const suggestionBtns = document.querySelectorAll('.suggestion-btn');
        
        // Model selector elements
        const modelSelector = document.getElementById('modelSelector');
        const modelBtn = document.getElementById('modelBtn');
        const modelBtnText = document.getElementById('modelBtnText');
        const modelMenu = document.getElementById('modelMenu');
        const modelItems = document.querySelectorAll('.model-item');
        
        let currentModel = 'deepseek-chat';

        // Sidebar collapse/expand
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

        // Back button
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/pages/menu.html';
            });
        }

        // New chat
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                chatMessages.innerHTML = '';
                chatMessages.appendChild(welcomeScreen);
                welcomeScreen.style.display = 'flex';
            });
        }

        // Attach button
        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', () => fileInput.click());
        }

        // Docs panel
        if (toggleDocsPanel && docsPanel) {
            toggleDocsPanel.addEventListener('click', () => docsPanel.classList.toggle('open'));
        }
        if (closePanelBtn && docsPanel) {
            closePanelBtn.addEventListener('click', () => docsPanel.classList.remove('open'));
        }

        // Model selector toggle
        if (modelBtn && modelSelector) {
            modelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                modelSelector.classList.toggle('open');
            });
            
            document.addEventListener('click', (e) => {
                if (!modelSelector.contains(e.target)) {
                    modelSelector.classList.remove('open');
                }
            });
        }

        // Model selection
        modelItems.forEach(item => {
            item.addEventListener('click', () => {
                modelItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                currentModel = item.dataset.model;
                const isPro = currentModel === 'deepseek-reasoner';
                
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

        // Suggestion buttons
        suggestionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                if (prompt && chatInput) {
                    chatInput.value = prompt;
                    chatInput.dispatchEvent(new Event('input'));
                    chatInput.focus();
                }
            });
        });

        // Chat input
        if (chatInput) {
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
                if (sendBtn) sendBtn.disabled = !chatInput.value.trim();
            });

            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (chatInput.value.trim()) {
                        chatForm.dispatchEvent(new Event('submit'));
                    }
                }
            });
        }

        // Form submit
        if (chatForm) {
            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = chatInput.value.trim();
                if (!message) return;

                if (welcomeScreen) welcomeScreen.style.display = 'none';
                
                addMessage(message, 'user', account?.name || 'Usuario');
                
                chatInput.value = '';
                chatInput.style.height = 'auto';
                if (sendBtn) sendBtn.disabled = true;

                const typingIndicator = showTypingIndicator();

                try {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    typingIndicator.remove();
                    
                    const response = `Gracias por tu consulta. He recibido: "${message}"\n\nEsta es una respuesta de demostración. La integración con DeepSeek AI está pendiente.`;
                    addMessage(response, 'assistant');
                } catch (error) {
                    typingIndicator.remove();
                    addMessage('Error al procesar tu mensaje.', 'assistant');
                }
            });
        }

        function addMessage(content, type, userName = 'Perxia') {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}`;
            
            const initials = type === 'user' 
                ? userName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2)
                : 'P';

            messageDiv.innerHTML = `
                <div class="message-avatar">${initials}</div>
                <div class="message-content">
                    <div class="message-bubble">
                        <p>${content.replace(/\n/g, '<br>')}</p>
                    </div>
                    <span class="message-time">${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;

            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function showTypingIndicator() {
            const div = document.createElement('div');
            div.className = 'message assistant';
            div.innerHTML = `
                <div class="message-avatar">P</div>
                <div class="message-content">
                    <div class="message-bubble">
                        <div class="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            `;
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return div;
        }

        console.log('✅ Chatbot listo');

    } catch (error) {
        console.error('❌ Error:', error);
        window.location.href = '/';
    }
});
