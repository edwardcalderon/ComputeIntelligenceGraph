# Synaptiq (Working Name)

## Conversational Infrastructure Intelligence Platform (CIG - Compute Intelligence graph)

### Proyecto -- Versión 2

------------------------------------------------------------------------

# 1. Introducción

Las organizaciones modernas dependen de infraestructuras distribuidas en
múltiples proveedores de nube como AWS, Google Cloud y Azure. Sin
embargo, la visibilidad de esta infraestructura y su relación con los
servicios de negocio suele estar fragmentada.

Los sistemas actuales presentan desafíos como:

-   múltiples herramientas de gestión
-   infraestructuras complejas y distribuidas
-   dificultad para comprender dependencias entre servicios
-   vendor lock‑in
-   falta de interfaces intuitivas para exploración de infraestructura

Este proyecto propone una **plataforma de descubrimiento de
infraestructura cloud y observabilidad conversacional**, donde un
sistema es capaz de:

1.  Conectarse a la infraestructura cloud del cliente
2.  Descubrir recursos automáticamente
3.  Construir un grafo de arquitectura
4.  Permitir interactuar con esta infraestructura mediante un chatbot

------------------------------------------------------------------------

# 2. Problema

Las empresas enfrentan tres problemas principales:

### 1. Fragmentación de infraestructura

Los recursos cloud están distribuidos en:

-   AWS
-   Google Cloud
-   Azure
-   Kubernetes clusters
-   servicios serverless

No existe una vista unificada.

### 2. Dependencias complejas

Las arquitecturas modernas incluyen múltiples capas:

-   compute
-   networking
-   databases
-   storage
-   analytics

Las dependencias entre estos componentes son difíciles de visualizar.

### 3. Interfaces poco intuitivas

Las herramientas actuales requieren:

-   conocimiento técnico profundo
-   uso de múltiples dashboards
-   análisis manual de logs o configuraciones

------------------------------------------------------------------------

# 3. Propuesta de Solución

Se propone una **plataforma que descubre automáticamente la
infraestructura cloud de un cliente, construye un modelo estructural de
su arquitectura y permite interactuar con ella mediante lenguaje
natural**.

Componentes principales:

-   Conectores cloud
-   Motor de descubrimiento
-   Grafo de infraestructura
-   Conectores de datos
-   Motor LLM
-   Interfaz conversacional

------------------------------------------------------------------------

# 4. Arquitectura del Sistema

``` mermaid
flowchart TB

User[Administrador]

WebUI[Web Dashboard]

Chat[Chat Interface]

Connector[Cloud Connectors]

Discovery[Infrastructure Discovery Engine]

Graph[(Infrastructure Graph DB)]

DataConnectors[Business Data Connectors]

LLM[LLM Engine]

User --> WebUI
User --> Chat

WebUI --> Connector
Connector --> Discovery

Discovery --> Graph

Graph --> DataConnectors

Graph --> LLM
DataConnectors --> LLM

LLM --> Chat
```

------------------------------------------------------------------------

# 5. Diagrama de Contexto

``` mermaid
flowchart TB

Admin[Administrador]

Platform[Synaptiq Platform]

AWS[AWS Cloud]
GCP[GCP Cloud]
Azure[Azure Cloud]

LLM[AI Engine]

Admin --> Platform

Platform --> AWS
Platform --> GCP
Platform --> Azure

Platform --> LLM
```

------------------------------------------------------------------------

# 6. Diagrama de Casos de Uso

``` mermaid
%%{init: {'flowchart':{'nodeSpacing':30,'rankSpacing':40}} }%%
flowchart TB

Admin[Administrador]

Use1((Conectar proveedor cloud))
Use2((Descubrir infraestructura))
Use3((Visualizar arquitectura))
Use4((Consultar infraestructura por chat))
Use5((Conectar servicios de datos))

Admin --> Use1
Admin --> Use2
Admin --> Use3
Admin --> Use4
Admin --> Use5
```

------------------------------------------------------------------------

# 7. Flujo de Descubrimiento de Infraestructura

``` mermaid
%%{init: {'sequence':{'diagramMarginX':10,'diagramMarginY':10}} }%%
sequenceDiagram

participant Admin
participant Web
participant Connector
participant CloudAPI
participant Discovery
participant GraphDB

Admin->>Web: conectar cuenta cloud

Web->>Connector: credenciales IAM / Service Account

Connector->>CloudAPI: listar recursos

CloudAPI-->>Connector: recursos detectados

Connector->>Discovery: enviar metadata

Discovery->>GraphDB: construir grafo infraestructura
```

------------------------------------------------------------------------

# 8. Flujo Conversacional

``` mermaid
sequenceDiagram

participant Admin
participant Chat
participant LLM
participant GraphDB

Admin->>Chat: ¿qué servicios dependen de la base de datos ventas?

Chat->>LLM: interpretar pregunta

LLM->>GraphDB: consultar dependencias

GraphDB-->>LLM: resultados

LLM-->>Chat: respuesta estructurada

Chat-->>Admin: mostrar resultado
```

------------------------------------------------------------------------

# 9. Componentes del Sistema

### 1. Cloud Connectors

Conectores que utilizan APIs oficiales:

-   AWS SDK
-   GCP SDK
-   Azure SDK

Permiten listar recursos cloud.

------------------------------------------------------------------------

### 2. Infrastructure Discovery Engine

Responsable de:

-   detectar recursos
-   mapear relaciones
-   construir dependencias

Ejemplo:

    EC2 → RDS
    Lambda → S3
    API → Database

------------------------------------------------------------------------

### 3. Infrastructure Graph

Base de datos que almacena la arquitectura.

Tecnologías posibles:

-   Neo4j
-   Amazon Neptune
-   ArangoDB

------------------------------------------------------------------------

### 4. Business Data Connectors

Permiten conectar:

-   bases de datos
-   sistemas analíticos
-   APIs de negocio

Siempre bajo autorización explícita.

------------------------------------------------------------------------

### 5. LLM Engine

Modelo que permite:

-   interpretar preguntas
-   traducirlas a consultas del grafo
-   generar respuestas en lenguaje natural

------------------------------------------------------------------------

# 10. MVP Propuesto

Primera versión del sistema soportará:

Proveedor cloud:

-   AWS

Recursos descubiertos:

-   EC2
-   RDS
-   S3
-   Lambda
-   IAM

Base de datos:

-   Neo4j

Interfaz:

-   Web dashboard
-   Chat web

------------------------------------------------------------------------

# 11. Tareas a Realizar

## Fase 1 -- Diseño

-   definir modelo de grafo de infraestructura
-   definir arquitectura del sistema
-   seleccionar tecnologías base

## Fase 2 -- Conectores Cloud

-   implementar conector AWS
-   listar recursos EC2
-   listar recursos RDS
-   listar recursos S3

## Fase 3 -- Motor de Descubrimiento

-   construir modelo de dependencias
-   detectar relaciones entre recursos

## Fase 4 -- Base de Datos de Infraestructura

-   implementar graph database
-   almacenar recursos descubiertos

## Fase 5 -- Interfaz Web

-   crear dashboard inicial
-   mostrar recursos descubiertos

## Fase 6 -- Integración LLM

-   interpretar preguntas
-   generar queries al grafo

## Fase 7 -- Chatbot

-   interfaz chat web
-   integración Telegram opcional

------------------------------------------------------------------------

# 12. Valor del Proyecto

El sistema permitirá:

-   visualizar infraestructura cloud automáticamente
-   comprender dependencias entre servicios
-   consultar arquitectura mediante lenguaje natural
-   reducir complejidad operativa

------------------------------------------------------------------------

# 13. Trabajos Futuros

-   soporte multi‑cloud
-   análisis de costos cloud
-   recomendaciones de optimización
-   detección de configuraciones inseguras
