# Perxia Help - Guía de Configuración

## 📋 Requisitos Previos

Antes de comenzar, necesitas tener configurado:

1. **Azure App Registration** (para autenticación)
2. **Azure AI Foundry** con DeepSeek deployment
3. **Azure Storage Account** (opcional, para documentos)
4. **Microsoft Copilot Studio** (opcional)

---

## 🔐 Paso 1: Configurar Azure App Registration

### 1.1 Crear App Registration

1. Ve al [Azure Portal](https://portal.azure.com)
2. Busca "App registrations" o "Registros de aplicaciones"
3. Haz clic en **+ New registration**
4. Completa:
   - **Name**: `Perxia Help`
   - **Supported account types**: Selecciona según tu caso
   - **Redirect URI**: 
     - Platform: `Single-page application (SPA)`
     - URI: `http://localhost:8000`
5. Haz clic en **Register**

### 1.2 Obtener valores necesarios

Después de crear la app, copia estos valores:

- **Application (client) ID**: Lo encuentras en la página "Overview"
- **Directory (tenant) ID**: También en "Overview"

### 1.3 Configurar Authentication

1. Ve a **Authentication** en el menú lateral
2. En **Single-page application**, verifica que esté:
   - `http://localhost:8000` ✅
3. Agrega para producción:
   - `https://tu-dominio.azurewebsites.net` (cuando despliegues)
4. En **Implicit grant and hybrid flows**, habilita:
   - ✅ **Access tokens**
   - ✅ **ID tokens**
5. Guarda cambios

### 1.4 Configurar API permissions (opcional)

1. Ve a **API permissions**
2. Permisos recomendados:
   - `User.Read` (Microsoft Graph)
   - `openid`
   - `profile`
   - `email`

---

## 🤖 Paso 2: Configurar DeepSeek en Azure AI Foundry

### 2.1 Crear Azure AI Foundry Resource

1. En Azure Portal, busca "Azure AI services"
2. Crea un nuevo recurso de **Azure OpenAI** o **Azure AI Foundry**
3. Completa:
   - **Subscription**: Tu suscripción
   - **Resource group**: Crea uno o usa existente
   - **Region**: Selecciona región disponible
   - **Name**: Ejemplo: `perxia-ai-foundry`
   - **Pricing tier**: Standard S0

### 2.2 Desplegar Modelos DeepSeek

1. Ve al recurso creado
2. Busca **Model deployments** o **Deployments**
3. Haz clic en **+ Create new deployment**
4. Selecciona:
   - **Model**: `deepseek-v3` o `deepseek-r1`
   - **Deployment name**: Ejemplo: `deepseek-v3`
   - **Version**: Latest
5. Espera a que se despliegue

### 2.3 Obtener Endpoint y API Key

1. Ve a **Keys and Endpoint** en el menú lateral
2. Copia:
   - **Endpoint**: Ejemplo: `https://perxia-ai-foundry.openai.azure.com/`
   - **Key 1** o **Key 2**: Tu API Key

---

## 📦 Paso 3: Configurar Azure Storage (Opcional)

### 3.1 Crear Storage Account

1. En Azure Portal, busca "Storage accounts"
2. Crea nuevo:
   - **Name**: Ejemplo: `perxiastorage`
   - **Performance**: Standard
   - **Replication**: LRS (más económico)

### 3.2 Crear Container

1. Ve al storage account creado
2. En **Data storage** → **Containers**
3. Crea nuevo container:
   - **Name**: `documents`
   - **Public access level**: Private

### 3.3 Generar SAS Token

1. Ve a **Shared access signature** en el menú
2. Configura permisos:
   - ✅ Read
   - ✅ Write
   - ✅ Delete
   - ✅ List
3. Selecciona fecha de expiración
4. Genera SAS token y copia

---

## ⚙️ Paso 4: Configurar la Aplicación

### 4.1 Crear archivo de configuración

1. Copia `config.example.js` como `config.js`:
   ```powershell
   Copy-Item config.example.js config.js
   ```

2. Abre `config.js` y completa:

```javascript
const CONFIG = {
    azure: {
        auth: {
            clientId: "abc123-def456-ghi789",              // Tu Client ID
            authority: "https://login.microsoftonline.com/xyz789-abc123",  // Tu Tenant ID
            redirectUri: "http://localhost:8000",
            postLogoutRedirectUri: "http://localhost:8000",
            scopes: ["openid", "profile", "email"]
        },
        cache: {
            cacheLocation: "localStorage",
            storeAuthStateInCookie: false
        }
    },

    deepseek: {
        endpoint: "https://perxia-ai-foundry.openai.azure.com/",  // Tu endpoint
        apiKey: "tu-api-key-aqui",                                // Tu API Key
        deploymentName: "deepseek-v3",                            // Tu deployment name
        apiVersion: "2024-08-01-preview",
        
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

    storage: {
        accountName: "perxiastorage",
        containerName: "documents",
        sasToken: "?sv=2021-06-08&ss=b&srt=sco&sp=rwdlac..."  // Tu SAS token
    },

    copilot: {
        iframeUrl: ""  // Se configura desde la UI
    },

    app: {
        name: "Perxia Help",
        version: "1.0.0",
        debug: true
    }
};
```

---

## 🚀 Paso 5: Ejecutar Localmente

### 5.1 Iniciar servidor local

```powershell
cd c:\Users\danielgarcia\Desktop\Perxia_Help
python -m http.server 8000
```

### 5.2 Abrir en navegador

Ve a: http://localhost:8000

### 5.3 Probar funcionalidades

1. **Login con Azure AD**: Haz clic en el botón "Microsoft Azure AD"
2. **Login con credenciales**: Usa cualquier email/password (demo)
3. **Chatbot**: Escribe mensajes y verás respuestas de DeepSeek
4. **Subir documentos**: Haz clic en adjuntar archivos

---

## 🔍 Verificar Configuración

### Modo Debug Activado

Con `debug: true`, verás mensajes en la consola del navegador (F12):

```
[PerxiaApp] Configuration loaded
[AzureAuth] MSAL initialized successfully
[DeepSeek] Sending message to DeepSeek
```

### Verificar en la consola:

1. Abre DevTools (F12)
2. Ve a la pestaña **Console**
3. Deberías ver logs de inicialización
4. Si hay errores, revisa la configuración

---

## 🐛 Solución de Problemas

### Error: "MSAL library not loaded"
- La app funcionará en modo demo
- Para Azure AD real, verifica que MSAL se cargue desde CDN

### Error: "API Error: 401"
- Verifica que el API Key sea correcto
- Verifica que el endpoint termine en `/`

### Error: "API Error: 404"
- Verifica que el deployment name sea correcto
- Verifica que el modelo esté desplegado en Azure

### Error: "Configuration file not found"
- Asegúrate de haber creado `config.js` desde `config.example.js`

---

## 📝 Notas de Seguridad

⚠️ **IMPORTANTE**:

1. **NUNCA** subas `config.js` a Git (ya está en `.gitignore`)
2. **NUNCA** compartas tu API Key públicamente
3. Usa variables de entorno en producción
4. Rota las API Keys periódicamente
5. Usa SAS tokens con permisos mínimos necesarios

---

## 🔄 Para Producción

Cuando despliegues a Azure:

1. Actualiza `redirectUri` en config y Azure Portal
2. Cambia `debug: false`
3. Usa Azure Key Vault para secretos
4. Configura CORS en Azure Storage
5. Habilita HTTPS

---

## 📞 Soporte

Si tienes problemas:
1. Verifica los logs en la consola (F12)
2. Revisa esta guía paso a paso
3. Verifica que todos los servicios estén creados en Azure
4. Contacta al equipo de desarrollo

---

© 2025 Perxia Help
