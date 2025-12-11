# Perxia Help - Guía de Configuración Completa

Esta guía te ayudará a configurar todos los servicios de Azure necesarios para Perxia Help.

---

## 📋 Servicios de Azure Requeridos

| Servicio | Propósito | Tier Recomendado |
|----------|-----------|------------------|
| **App Registration** | Autenticación Azure AD | Free |
| **Azure AI Foundry** | DeepSeek + Embeddings | Standard |
| **Azure AI Search** | Búsqueda vectorial/semántica | Basic/Standard |
| **Azure Document Intelligence** | Extracción de texto PDF/Word | S0 |
| **Azure Storage Account** | Almacenamiento de documentos | Standard LRS |

---

## 🔐 Paso 1: Azure App Registration (Autenticación)

### 1.1 Crear la App Registration

1. Ve al [Azure Portal](https://portal.azure.com)
2. Busca **"App registrations"**
3. Clic en **+ New registration**
4. Configura:
   - **Name**: `Perxia Help`
   - **Supported account types**: `Single tenant` (tu organización)
   - **Redirect URI**: 
     - Platform: `Single-page application (SPA)`
     - URI: `http://localhost:3000`
5. Clic en **Register**

### 1.2 Obtener Credenciales

En la página **Overview** de tu app, copia:

```
AZURE_TENANT_ID=<Directory (tenant) ID>
AZURE_CLIENT_ID=<Application (client) ID>
```

### 1.3 Crear Client Secret

1. Ve a **Certificates & secrets**
2. Clic en **+ New client secret**
3. Descripción: `Perxia Help Backend`
4. Expiración: 24 meses
5. Copia el **Value** (solo se muestra una vez):

```
AZURE_CLIENT_SECRET=<el valor del secret>
```

### 1.4 Configurar Redirect URIs

1. Ve a **Authentication**
2. En **Single-page application**, añade:
   - `http://localhost:3000`
   - `http://localhost:8080`
   - `https://tu-dominio.azurewebsites.net` (producción)
3. Habilita:
   - ✅ Access tokens
   - ✅ ID tokens
4. Guarda cambios

---

## 🤖 Paso 2: Azure AI Foundry (DeepSeek + Embeddings)

### 2.1 Crear el Recurso

1. Ve a [Azure AI Foundry](https://ai.azure.com)
2. Crea un nuevo **Hub** y **Project**
3. O busca "Azure AI services" en Azure Portal

### 2.2 Desplegar Modelos

Despliega estos 3 modelos:

| Modelo | Deployment Name | Propósito |
|--------|-----------------|-----------|
| `DeepSeek-V3.1` | `DeepSeek-V3.1` | Chat estándar (Copilot) |
| `DeepSeek-R1-0528` | `DeepSeek-R1-0528` | Chat avanzado (Copilot Pro) |
| `text-embedding-3-small` | `text-embedding-3-small` | Embeddings para RAG |

### 2.3 Obtener Credenciales

En **Keys and Endpoint** o en el proyecto de AI Foundry:

```
AZURE_OPENAI_ENDPOINT=https://tu-recurso.services.ai.azure.com/
AZURE_OPENAI_API_KEY=<tu-api-key>
DEEPSEEK_DEPLOYMENT_V3=DeepSeek-V3.1
DEEPSEEK_DEPLOYMENT_R1=DeepSeek-R1-0528
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-12-01-preview
```

---

## 🔍 Paso 3: Azure AI Search

### 3.1 Crear el Recurso

1. En Azure Portal, busca **"Azure AI Search"**
2. Clic en **+ Create**
3. Configura:
   - **Subscription**: Tu suscripción
   - **Resource group**: El mismo grupo
   - **Service name**: `perxia-search` (único globalmente)
   - **Location**: Misma región que otros servicios
   - **Pricing tier**: **Basic** (para producción) o **Free** (desarrollo)
4. Clic en **Review + create**

### 3.2 Obtener Credenciales

1. Ve al recurso creado
2. En **Settings** → **Keys**, copia:

```
AZURE_SEARCH_ENDPOINT=https://tu-search.search.windows.net
AZURE_SEARCH_API_KEY=<Admin key>
AZURE_SEARCH_INDEX_NAME=perxia-documents
```

> **Nota**: El índice se crea automáticamente al iniciar la aplicación.

---

## 📄 Paso 4: Azure Document Intelligence

### 4.1 Crear el Recurso

1. En Azure Portal, busca **"Document Intelligence"** (antes Form Recognizer)
2. Clic en **+ Create**
3. Configura:
   - **Subscription**: Tu suscripción
   - **Resource group**: El mismo grupo
   - **Region**: Misma región que otros servicios
   - **Name**: `perxia-doc-intel` (único)
   - **Pricing tier**: **S0** (Standard)
4. Clic en **Review + create**

### 4.2 Obtener Credenciales

1. Ve al recurso creado
2. En **Keys and Endpoint**, copia:

```
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://tu-doc-intel.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=<Key 1>
```

---

## 📦 Paso 5: Azure Storage Account

### 5.1 Crear el Storage Account

1. En Azure Portal, busca **"Storage accounts"**
2. Clic en **+ Create**
3. Configura:
   - **Subscription**: Tu suscripción
   - **Resource group**: El mismo grupo
   - **Storage account name**: `perxiastorage` (único)
   - **Region**: Misma región
   - **Performance**: **Standard**
   - **Redundancy**: **LRS** (más económico)
4. Clic en **Review + create**

### 5.2 Crear el Container

1. Ve al Storage Account creado
2. En **Data storage** → **Containers**
3. Clic en **+ Container**
4. Nombre: `documents`
5. Access level: **Private**
6. Clic en **Create**

### 5.3 Obtener Credenciales

1. En **Security + networking** → **Access keys**, copia:

```
AZURE_STORAGE_ACCOUNT_NAME=perxiastorage
AZURE_STORAGE_ACCOUNT_KEY=<key1>
AZURE_STORAGE_CONTAINER_NAME=documents
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
```

---

## ⚙️ Paso 6: Configurar la Aplicación

### 6.1 Crear archivo .env

```powershell
cd c:\Users\danielgarcia\Desktop\Perxia_Help
Copy-Item .env.example .env
code .env
```

### 6.2 Completar todas las variables

Copia los valores obtenidos en los pasos anteriores:

```env
# Server
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:8080

# Azure AD
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_REDIRECT_URI=http://localhost:3000/auth/callback

# Azure AI Foundry
AZURE_OPENAI_ENDPOINT=https://tu-recurso.services.ai.azure.com/
AZURE_OPENAI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_DEPLOYMENT_V3=DeepSeek-V3.1
DEEPSEEK_DEPLOYMENT_R1=DeepSeek-R1-0528
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://tu-search.search.windows.net
AZURE_SEARCH_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_SEARCH_INDEX_NAME=perxia-documents

# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://tu-doc-intel.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=perxiastorage
AZURE_STORAGE_ACCOUNT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AZURE_STORAGE_CONTAINER_NAME=documents
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...

# Security
JWT_SECRET=genera-un-valor-seguro-aqui
SESSION_SECRET=genera-otro-valor-seguro-aqui
```

---

## 🚀 Paso 7: Ejecutar la Aplicación

### 7.1 Instalar dependencias

```powershell
npm install
```

### 7.2 Iniciar en modo desarrollo

```powershell
npm run dev
```

### 7.3 Inicializar el índice de búsqueda

En otra terminal o usando Postman:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/documents/init-index" -Method POST
```

### 7.4 Abrir la aplicación

- Frontend: http://localhost:3000
- API Health: http://localhost:3000/api/health

---

## ✅ Verificar que Todo Funciona

### 1. Health Check
```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX..."
}
```

### 2. Subir un documento
1. Abre http://localhost:3000
2. Inicia sesión
3. Ve al Chatbot
4. Abre el panel de documentos (icono 📄)
5. Arrastra un PDF o Word
6. Espera el mensaje de éxito

### 3. Preguntar sobre el documento
1. En el chat, escribe: "¿De qué trata el documento?"
2. El sistema buscará contexto relevante (RAG)
3. Recibirás una respuesta basada en el contenido

---

## 🐛 Solución de Problemas

### Error 401 en Document Intelligence
- Verifica `AZURE_DOCUMENT_INTELLIGENCE_KEY`
- Asegúrate de usar el endpoint completo con `/`

### Error "Index not found" en Search
- Ejecuta `POST /api/documents/init-index`
- Verifica `AZURE_SEARCH_API_KEY`

### Error de embeddings
- Verifica que el modelo `text-embedding-3-small` esté desplegado
- Revisa `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`

### Documento no se procesa
- Verifica que el archivo sea PDF o DOCX
- Máximo 50 MB
- Revisa los logs del servidor

### Out of Memory
```powershell
# Aumentar memoria en package.json si es necesario
# NODE_OPTIONS=--max-old-space-size=4096
```

---

## 🔒 Seguridad en Producción

### Checklist
- [ ] Cambiar `JWT_SECRET` y `SESSION_SECRET` a valores únicos y seguros
- [ ] Usar Azure Key Vault para almacenar secretos
- [ ] Habilitar HTTPS en App Service
- [ ] Configurar firewall en Storage Account
- [ ] Limitar CORS origins a tu dominio
- [ ] Rotar API keys periódicamente
- [ ] Configurar Azure AD conditional access

### Variables de Producción

```env
NODE_ENV=production
CLIENT_URL=https://tu-dominio.azurewebsites.net
AZURE_REDIRECT_URI=https://tu-dominio.azurewebsites.net/auth/callback
ALLOWED_ORIGINS=https://tu-dominio.azurewebsites.net
```

---

## 📦 Desplegar en Azure App Service

### Usando Azure CLI

```bash
# 1. Crear App Service Plan
az appservice plan create \
  --resource-group perxia-rg \
  --name perxia-plan \
  --sku B1 \
  --is-linux

# 2. Crear Web App
az webapp create \
  --resource-group perxia-rg \
  --plan perxia-plan \
  --name perxia-help \
  --runtime "NODE|18-lts"

# 3. Configurar variables de entorno
az webapp config appsettings set \
  --resource-group perxia-rg \
  --name perxia-help \
  --settings @appsettings.json

# 4. Desplegar
az webapp deployment source config-zip \
  --resource-group perxia-rg \
  --name perxia-help \
  --src perxia-help.zip
```

### Usando VS Code

1. Instala la extensión Azure App Service
2. Click derecho en el proyecto → Deploy to Web App
3. Selecciona o crea tu App Service
4. Configura las variables en Azure Portal

---

## 📞 Soporte

- **Documentación**: Este archivo y README.md
- **Issues**: Revisa los logs del servidor (`npm run dev`)
- **Azure**: [Documentación oficial de Azure](https://docs.microsoft.com/azure)

---

© 2025 Perxia Help
