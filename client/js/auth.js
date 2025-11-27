// ============================================
// PERXIA HELP - AZURE AD AUTHENTICATION SERVICE
// ============================================
// MSAL.js wrapper para autenticación con Azure AD

class AzureAuthService {
    constructor() {
        this.msalInstance = null;
        this.account = null;
        this.isInitialized = false;
        this.isInteracting = false;
        this.initPromise = this.initializeMSAL();
    }

    /**
     * Inicializa MSAL con configuración de Azure AD
     */
    async initializeMSAL() {
        try {
            console.log('🔧 Iniciando MSAL...');

            // NO limpiar estados aquí - puede romper el flujo de redirect
            // this.clearAuthStates();

            // Esperar a que config.js cargue la configuración dinámica
            await this.waitForConfig();

            if (!CONFIG.azure.auth.clientId) {
                throw new Error('Azure AD no está configurado. Verifica el archivo .env en el servidor.');
            }

            // Configuración de MSAL
            const msalConfig = {
                auth: {
                    clientId: CONFIG.azure.auth.clientId,
                    authority: CONFIG.azure.auth.authority,
                    redirectUri: window.location.origin,
                    postLogoutRedirectUri: window.location.origin,
                    navigateToLoginRequestUrl: false // Importante: debe ser false para SPAs
                },
                cache: {
                    cacheLocation: 'localStorage',
                    storeAuthStateInCookie: false
                },
                system: {
                    allowNativeBroker: false,
                    windowHashTimeout: 9000,
                    iframeHashTimeout: 9000,
                    loadFrameTimeout: 9000,
                    loggerOptions: {
                        loggerCallback: (level, message, containsPii) => {
                            if (containsPii) return;
                            switch (level) {
                                case msal.LogLevel.Error:
                                    console.error('MSAL Error:', message);
                                    break;
                                case msal.LogLevel.Warning:
                                    console.warn('MSAL Warning:', message);
                                    break;
                                case msal.LogLevel.Info:
                                    console.log('MSAL Info:', message);
                                    break;
                                default:
                                    break;
                            }
                        },
                        logLevel: msal.LogLevel.Info // Cambiar a Info para ver más detalles
                    }
                }
            };

            console.log('🔧 Configuración MSAL:');
            console.log('  - Client ID:', msalConfig.auth.clientId);
            console.log('  - Authority:', msalConfig.auth.authority);
            console.log('  - Redirect URI:', msalConfig.auth.redirectUri);

            this.msalInstance = new msal.PublicClientApplication(msalConfig);
            await this.msalInstance.initialize();

            // Manejar el redirect después del login
            await this.handleRedirectPromise();

            this.isInitialized = true;
            console.log('✅ MSAL inicializado correctamente');

        } catch (error) {
            console.error('❌ Error fatal al inicializar MSAL:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Espera a que config.js cargue la configuración dinámica
     */
    async waitForConfig() {
        // Cargar config una sola vez
        if (typeof loadDynamicConfig === 'function') {
            await loadDynamicConfig();
        }

        const maxAttempts = 50;
        let attempts = 0;

        while (!CONFIG.azure.auth.clientId && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!CONFIG.azure.auth.clientId) {
            throw new Error('No se pudo cargar la configuración de Azure AD del servidor');
        }
    }

    /**
     * Limpia estados de autenticación que pueden causar conflictos
     */
    clearAuthStates() {
        try {
            // NO limpiar todas las claves de MSAL, solo las problemáticas
            // Buscar solo claves de error específicas, NO las de state/nonce
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                // Solo eliminar claves que causan el error "interaction_in_progress"
                if (key && key.includes('msal') && 
                    (key.includes('.interaction.status') || key.includes('.active.account'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => {
                console.log('🧹 Limpiando:', key);
                localStorage.removeItem(key);
            });

            // No tocar sessionStorage para no romper el flujo de redirect
        } catch (error) {
            console.warn('Error limpiando estados:', error);
        }
    }

    /**
     * Maneja el redirect después del login de Azure AD
     */
    async handleRedirectPromise() {
        try {
            console.log('🔄 Procesando handleRedirectPromise...');
            console.log('📍 URL actual:', window.location.href);
            console.log('🔗 Hash actual:', window.location.hash);
            
            const response = await this.msalInstance.handleRedirectPromise();
            
            if (response) {
                console.log('✅ Login exitoso:', response.account.username);
                console.log('📋 Cuenta recibida:', response.account);
                this.account = response.account;
                this.msalInstance.setActiveAccount(response.account);
                this.isInteracting = false;
                
                // Verificar que la cuenta se guardó
                const accounts = this.msalInstance.getAllAccounts();
                console.log('✅ Cuentas guardadas en MSAL:', accounts.length);
                
                return response;
            }

            // Si no hay response, verificar si ya hay una cuenta activa
            const accounts = this.msalInstance.getAllAccounts();
            console.log('📊 Cuentas existentes:', accounts.length);
            if (accounts.length > 0) {
                this.account = accounts[0];
                this.msalInstance.setActiveAccount(accounts[0]);
                console.log('✅ Cuenta activa restaurada:', accounts[0].username);
            } else {
                console.log('ℹ️ No hay cuentas guardadas');
            }

            return null;
        } catch (error) {
            console.error('❌ Error en handleRedirectPromise:', error);
            console.error('❌ Error code:', error.errorCode);
            console.error('❌ Error message:', error.errorMessage);
            
            // Si hay error de interacción en progreso, limpiar y recargar
            if (error.errorCode === 'interaction_in_progress') {
                console.warn('⚠️ Interacción en progreso detectada, limpiando...');
                this.clearAuthStates();
                window.location.reload();
            }
            
            throw error;
        }
    }

    /**
     * Inicia el proceso de login con Azure AD
     */
    async loginWithAzureAD() {
        try {
            console.log('🔐 Iniciando login con Azure AD...');

            // Prevenir múltiples llamadas simultáneas
            if (this.isInteracting) {
                console.warn('⚠️ Ya hay una interacción en progreso');
                return;
            }

            this.isInteracting = true;

            const loginRequest = {
                scopes: CONFIG.azure.auth.scopes,
                prompt: 'select_account'
            };

            await this.msalInstance.loginRedirect(loginRequest);

        } catch (error) {
            this.isInteracting = false;
            console.error('❌ Error en login:', error);
            throw error;
        }
    }

    /**
     * Verifica si el usuario está autenticado
     */
    async isAuthenticated() {
        try {
            await this.initPromise;

            const accounts = this.msalInstance.getAllAccounts();
            console.log('🔍 isAuthenticated() - Cuentas encontradas:', accounts.length);
            if (accounts.length > 0) {
                console.log('✅ Usuario autenticado:', accounts[0].username);
            }
            return accounts.length > 0;
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            return false;
        }
    }

    /**
     * Obtiene la cuenta actual del usuario
     */
    getAccount() {
        if (!this.msalInstance) return null;

        const account = this.msalInstance.getActiveAccount();
        if (account) return account;

        const accounts = this.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            this.msalInstance.setActiveAccount(accounts[0]);
            return accounts[0];
        }

        return null;
    }

    /**
     * Obtiene un token de acceso para llamar APIs
     */
    async getAccessToken() {
        try {
            await this.initPromise;

            const account = this.getAccount();
            if (!account) {
                throw new Error('No hay usuario autenticado');
            }

            const request = {
                scopes: CONFIG.azure.auth.scopes,
                account: account
            };

            const response = await this.msalInstance.acquireTokenSilent(request);
            return response.accessToken;

        } catch (error) {
            console.error('Error obteniendo token:', error);

            // Si falla el token silencioso, intentar con popup
            if (error.errorCode === 'interaction_required' || 
                error.errorCode === 'consent_required' ||
                error.errorCode === 'login_required') {
                
                try {
                    const request = {
                        scopes: CONFIG.azure.auth.scopes
                    };
                    const response = await this.msalInstance.acquireTokenPopup(request);
                    return response.accessToken;
                } catch (popupError) {
                    console.error('Error en popup:', popupError);
                    throw popupError;
                }
            }

            throw error;
        }
    }

    /**
     * Cierra sesión del usuario
     */
    async logout() {
        try {
            console.log('👋 Cerrando sesión...');

            // Limpiar estados locales
            this.clearAuthStates();
            this.account = null;
            this.isInteracting = false;

            // Construir URL de logout de Azure
            const account = this.getAccount();
            const tenantId = CONFIG.AZURE.tenantId || CONFIG.azure.auth.authority.split('/').pop();
            const logoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`;

            // Redirigir a Azure para cerrar sesión completamente
            window.location.href = logoutUrl;

        } catch (error) {
            console.error('❌ Error en logout:', error);
            // En caso de error, forzar limpieza y redirect
            this.clearAuthStates();
            window.location.href = '/';
        }
    }
}

// Crear instancia global
const authService = new AzureAuthService();

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = authService;
}
