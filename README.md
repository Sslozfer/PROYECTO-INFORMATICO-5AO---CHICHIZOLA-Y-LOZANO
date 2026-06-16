# Proyecto Borasi — Guía de uso local

## 1. Levantar la base de datos

```bash
docker compose up -d db
```

Postgres queda disponible en `localhost:5433` (usuario `postgres`, password
`postgres`, db `borasi`). El esquema (`database/schema.sql` y
`database/migration_v4_hiring.sql`) se carga solo la primera vez que se crea
el volumen `pgdata`.

> Si ya levantaste el proyecto antes y cambiaste el SQL, hay que recrear el
> volumen: `docker compose down -v && docker compose up -d db`

## 2. Backend (NestJS)

```bash
cd backend/api
npm install
npm run start:dev
```

- Corre en `http://localhost:3000`.
- Usa el `.env` ya incluido (`DB_PORT=5433`, apunta a la db del paso 1).

### Error "ECONNREFUSED ::1:5433 / 127.0.0.1:5433"
Significa que el backend está corriendo pero **la base de datos no está
levantada**. Solución: correr el paso 1 (`docker compose up -d db`) y
verificar que el contenedor esté `healthy`:

```bash
docker compose ps
```

## 3. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

- Corre en `http://localhost:3001` (puerto fijado en `package.json` para no
  chocar con el backend, que usa el 3000).
- Usa `.env.local` ya incluido (`NEXT_PUBLIC_API_URL=http://localhost:3000`).

## 4. Crear un usuario y loguearse

1. Ir a `http://localhost:3001/register`, crear una cuenta (`Profesional` o
   `Empresa`).
2. Iniciar sesión en `/login`.

### Datos de ejemplo (seed)

Para tener datos reales con los que probar (rubros, subáreas con pesos,
empresas, trabajadores, scores y publicaciones):

```bash
cd backend/api
npm run seed
```

Crea (de forma idempotente — se puede correr varias veces):
- 3 rubros: Desarrollo de Software, Marketing Digital, Diseño UX/UI.
- Subáreas/skills por rubro con pesos `employer/peer/client` distintos.
- 3 empresas (TechCorp, InnovaLabs, CloudWorks) con sus cuentas `company`.
- 5 trabajadores con empleos, ratings y `performance_score` calculado como
  promedio ponderado de sus subáreas.
- Perfiles de búsqueda activos (para `/professionals` con filtro por rubro).
- 3 publicaciones de empleo (`/job-posts`).

Todas las cuentas usan la contraseña `password123`:
`admin@borasi.com`, `rrhh@techcorp.com`, `rrhh@innovalabs.io`,
`rrhh@cloudworks.dev`, `juan@example.com`, `lucia@example.com`,
`pedro@example.com`, `maria@example.com`, `carlos@example.com`.

---

## Separación de cuentas Usuario vs Empresa

- **Usuario (`role: user`)**: puede aplicar a empleos (`/jobs`), ver y
  retirar sus solicitudes (`/applications`), evaluar a otros en subáreas
  específicas (`/my-evaluations`). No puede crear publicaciones ni ver
  candidatos.
- **Empresa (`role: company`)**: gestiona sus búsquedas y candidatos en
  `/job-posts` (crear publicación, ver candidatos, aceptar/rechazar) y
  `/candidates`. No puede aplicar a empleos ni ver `/applications`/`/jobs`.
- Estas restricciones están aplicadas tanto en el menú lateral como en el
  backend (`@Roles(...)` en `hiring.controller.ts` y `matching.controller.ts`).
- El "Score de Confianza" (`global_trust_score`) ya no se expone a usuarios
  ni empresas: es un valor interno de cálculo, solo visible para `admin`
  (`GET /users/:id/admin-view`).
- Las evaluaciones ahora son por **subárea** (no hay "evaluar a la persona en
  general"): se elige rubro → subárea, y solo se muestran las subáreas que
  esa relación (empleador/par/cliente) puede evaluar según
  `employer_weight`/`peer_weight`/`client_weight`. El score global de cada
  persona es el promedio ponderado de sus subáreas (`category_weight`).


## Funcionalidades completadas en esta vuelta

- **Búsqueda**: las barras de búsqueda de `search`, `professionals`,
  `companies`, `jobs` y `candidates` ahora filtran en vivo.
- **Profesionales** (`/professionals`): lista real desde
  `GET /users/ranking`. "Ver Perfil" abre `/professionals/[id]` (nuevo),
  con datos reales de `GET /users/:id`.
- **Empresas** (`/companies`): lista real desde `GET /companies`. "Ver
  Empresa" abre `/companies/[id]` (nuevo), con datos reales de
  `GET /companies/:id`. Se corrigió el tipo `Company` en el frontend, que
  no coincidía con las columnas reales de la entidad backend.
- **Mis Solicitudes** (`/applications`): conectado a
  `GET /hiring/my-applications`. "Cancelar" llama a
  `PATCH /hiring/applications/:id/withdraw`. "Ver Detalles" expande info de
  la solicitud (compatibilidad, motivo de rechazo, etc).
- **Empleos** (`/jobs`): el botón "Aplicar" llama a
  `POST /hiring/apply/:jobPostId`.
- **Evaluaciones** (`/ratings`): "Nueva Evaluación" lleva a
  `/my-evaluations`.
- **Mis Evaluaciones** (`/my-evaluations`): pestañas "Recibidas" y "Dadas"
  ahora muestran datos reales. Se agregaron al backend los endpoints
  `GET /ratings/received` y `GET /ratings/given` (no existían).
- Se agregó el endpoint `GET /categories` (faltaba — el modal de "Nueva
  Evaluación" lo llamaba y daba 404).
- **Mi Perfil** (`/profile`): "Editar" lleva a `/settings`. "+ Agregar
  Experiencia" abre un modal real conectado a `POST /employments`.
- **Configuración** (`/settings`): "Guardar Cambios" ahora funciona contra
  el nuevo endpoint `PATCH /users/me` (no existía, se agregó).
- Se arregló el botón de menú móvil (`MainLayout`): el ícono X nunca cerraba
  el sidebar porque siempre hacía `setSidebarOpen(true)`.

## Pendiente (requiere más trabajo de backend, fuera de alcance acá)

- "Guardar" en Privacidad y "Verificar" identidad (Configuración): no hay
  columnas/endpoints para preferencias de privacidad ni flujo de KYC.
- `candidates` (búsqueda de candidatos para empresas) y la lista completa de
  `jobs`/`mockJobs` siguen usando datos mock: el backend solo expone
  matching vía `/matching/jobs/:jobTypeId` y `/matching/posts/:id/candidates`,
  que requieren que el usuario/empresa tenga un perfil de matching configurado
  (no hay UI para eso todavía).


## Deploy

Frontend:
- Vercel
- Root Directory: frontend

Backend:
- Railway
- Root Directory: backend/api

Database:
- Ejecutar database/schema.sql
- Ejecutar database/migration_v4_hiring.sql
