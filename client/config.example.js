// ============================================
// PERXIA HELP - CONFIGURATION FILE
// ============================================
// Copia este archivo como 'config.js' y completa con tus valores reales

const CONFIG = {
    // Azure AD B2C / App Registration
    azure: {
        auth: {
            clientId: "TU_CLIENT_ID_AQUI",                    // Application (client) ID
            authority: "https://login.microsoftonline.com/TU_TENANT_ID_AQUI",  // o tu dominio B2C
            redirectUri: "http://localhost:8000",             // Para desarrollo local
            postLogoutRedirectUri: "http://localhost:8000",
            scopes: ["openid", "profile", "email"]
        },
        cache: {
            cacheLocation: "localStorage",
            storeAuthStateInCookie: false
        }
    },

    // DeepSeek AI Foundry Configuration
    deepseek: {
        endpoint: "https://TU-RESOURCE.openai.azure.com/",   // Tu endpoint de AI Foundry
        apiKey: "TU_API_KEY_AQUI",                           // API Key de Azure AI
        deploymentName: "deepseek-v3",                       // Nombre de tu deployment
        apiVersion: "2024-08-01-preview",                    // Versión de la API
        
        // Modelos disponibles
        models: {
            v3: {
                name: "deepseek-v3",
                displayName: "DeepSeek V3",
                maxTokens: 4096
            },
            r1: {
                name: "deepseek-r1",
                displayName: "DeepSeek R1 (DeepThink)",
                maxTokens: 8192
            }
        }
    },

    // Azure Storage para documentos
    storage: {
        accountName: "TU_STORAGE_ACCOUNT",
        containerName: "documents",
        sasToken: "TU_SAS_TOKEN_AQUI"  // Token SAS para acceso
    },

    // Microsoft Copilot Studio
    copilot: {
        iframeUrl: ""  // Se configura desde la UI
    },

    // Configuración general
    app: {
        name: "Perxia Help",
        version: "1.0.0",
        debug: true  // Cambiar a false en producción
    }
};

// No modificar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
