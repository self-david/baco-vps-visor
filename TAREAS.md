# Tareas de VPS Manager

Especificación: [readme.md](readme.md) (sección 20). El estado se marca según el **código actual**, no según el texto de la especificación.

**No marcar una fase como hecha** solo porque exista un prototipo. Una fase está completa cuando cubre su resultado descrito en el README.

Leyenda: `[x]` hecha · `[ ]` pendiente.

---

## Fase 0 — Preparación

Estado: **parcial**

- [x] Crear repositorio principal.
- [x] Definir estructura (`installer/`, `apps/manager/`).
- [x] Mantener la API en Node `.mjs` y generar la interfaz estática con Astro.
- [x] Configurar convenciones.
- [x] Preparar entorno local.
- [x] Preparar VPS de pruebas (`VPS_MANAGER_TEST_MODE`).
- [x] Crear documentación inicial.

**Resultado:** repositorio funcional y entorno reproducible.

---

## Fase 1 — Instalador y panel inicial

Estado: **hecha**

- [x] Instalar Docker.
- [x] Inicializar Swarm.
- [x] Preparar redes.
- [x] Desplegar Traefik.
- [x] Desplegar panel mínimo con autenticación.
- [x] Restringir la consulta de Docker a endpoints de lectura.

**Resultado:** dashboard inicial de solo lectura accesible mediante HTTPS.

---

## Fase 2 — API y agente

Estado: **parcial**

- [x] Crear API (mínima, Node.js).
- [x] Crear autenticación (un administrador, cookie de sesión).
- [x] Crear base de datos (PostgreSQL).
- [x] Crear agente host aislado para reiniciar y escalar servicios Swarm etiquetados `vps-manager.managed=true`; el proxy Docker conserva solo lectura.
- [x] Implementar consulta de Docker.
- [x] Implementar reinicio y escalado autenticados y auditados de servicios administrados con confirmación y estado de resultado.
- [x] Limitar el escalado a 1–100 réplicas para servicios Swarm administrados en modo replicado; el agente aplica solo una allowlist fija y mantiene el servicio API de VPS Manager en una réplica.
- [x] Persistir reinicios de servicios administrados como tareas consultables con historial en PostgreSQL.
- [x] Ampliar el sistema a una cola persistente con handlers registrados, leases, reintentos limitados y recuperación idempotente tras reinicios del backend; reinicios y escalados de servicios son los handlers habilitados.

**Resultado:** backend capaz de administrar Docker.

---

## Fase 3 — Dashboard

Estado: **parcial** (MVP mayormente de lectura con operaciones controladas; migración progresiva a Astro + React + Tailwind)

- [x] Diseñar interfaz con Astro, React y Tailwind; mantener las operaciones existentes durante la migración progresiva de la interfaz.
- [x] Separar el dashboard en pestañas accesibles por categoría e incluir placeholders explícitos para módulos pendientes.
- [x] Dashboard general.
- [x] Contenedores.
- [x] Servicios.
- [x] Stacks.
- [x] Logs.
- [x] Estados.

**Resultado:** administración básica desde navegador.

---

## Fase 4 — Gitea

Estado: **Gitea, proyectos Git y recepción autenticada de push implementados; falta validar en un VPS con dominio público**

- [x] Crear la estructura del catálogo de aplicaciones y el aviso reutilizable para dependencias como Gitea.
- [x] Desplegar Gitea como aplicación opcional desde el catálogo, con HTTPS bajo subdominio.
- [x] Configurar SSH.
- [x] Crear repositorios privados desde el panel, con token almacenado como secreto Swarm versionado y conservado en actualizaciones del stack.
- [x] Consultar ramas de repositorios Gitea y cambiar la rama predeterminada desde el panel, con permisos de administración y auditoría.
- [x] Configurar webhooks de push autenticados e idempotentes; registrar eventos sin desplegar proyectos todavía.
- [x] Integrar repositorios privados y ramas existentes con registros de proyectos; sin activar despliegues todavía.

**Resultado:** servidor Git privado.

---

## Fase 5 — Deploy automático

Estado: **parcial** (build, despliegue, variables, dominios y rollback manuales; falta automatizar push)

- [x] Integrar BuildKit mediante Docker Buildx para construir la imagen del panel durante la instalación.
- [x] Construir manualmente imágenes de repositorios Gitea registrados y publicarlas en el registro privado, etiquetadas por commit y sin desplegarlas.
- [x] Configurar el registro privado desde el navegador, con HTTPS, autenticación y almacenamiento persistente.
- [x] Desplegar manualmente en modo global la última imagen construida, con una tarea por nodo activo del Swarm y sin publicar puertos.
- [x] Consultar el estado de los nodos y aprovisionar VPS Ubuntu 24.04 adicionales por SSH con fingerprint verificado, instalación de Docker y reglas UFW restringidas a una CIDR privada.
- [x] Configurar variables de entorno por proyecto; se almacenan en archivo restringido del VPS y se aplican al desplegar.
- [x] Administrar dominios en un panel central, conectar Cloudflare por dominio, sincronizar registros A y asignar hostnames/puertos HTTP a proyectos.
- [x] Revertir un proyecto a un despliegue anterior exitoso, conservando su configuración actual.

**Alcance actual:** variables, dominios y rollback están implementados para proyectos Git. Las aplicaciones arbitrarias del catálogo, el montaje de secretos y el despliegue automático por `git push` siguen pendientes.

**Resultado previsto:** `git push` despliega proyectos; en el estado actual, builds y despliegues se solicitan manualmente desde el panel.

---

## Fase 6 — Catálogo

Estado: **parcial** (catálogo persistente y configuración de Supabase implementados; despliegue de Supabase pendiente)

- [x] Definir y validar plantillas versionadas de imagen Docker y variables de entorno para aplicaciones de un contenedor; sin puertos ni volúmenes configurables.
- [x] Instalar n8n como servicio Swarm de una réplica, con volumen persistente administrado, clave de cifrado en secreto Swarm y dominio Cloudflare/HTTPS desde el panel.
- [x] Instalar PostgreSQL como servicio Swarm privado de una réplica, con volumen local administrado, contraseña generada como secreto Swarm y entrega de credenciales de un solo uso.
- [x] Posponer Redis; no se requiere en el alcance actual.
- [ ] Evaluar MinIO solo si una aplicación o los backups requieren almacenamiento de objetos.
- [x] Crear catálogo y persistencia de configuración por VPS para Supabase self-hosted, incluyendo servicios, dominios, límites y secretos declarados.
- [ ] Implementar el despliegue Swarm de Supabase, HTTPS y generación/montaje de secretos.
- [ ] Implementar actualizaciones.

**Resultado:** catálogo de aplicaciones.

---

## Fase 7 — Monitoreo

Estado: **parcial** (métricas, históricos y alertas básicas; aún faltan otros recolectores y alertas)

- [ ] Desplegar Prometheus.
- [ ] Desplegar cAdvisor.
- [ ] Desplegar Node Exporter.
- [x] Consultar CPU y RAM actuales por contenedor, bajo demanda y con muestreo configurable.
- [x] Agrupar consumo puntual por stack/proyecto.
- [x] Guardar históricos de métricas en PostgreSQL y configurar el intervalo.
- [x] Mostrar alertas de CPU/RAM en el panel con umbrales configurables y dos muestras consecutivas.
- [x] Añadir alertas de disco, disponibilidad de servicios y reinicios.
- [x] Añadir alertas HTTP de servicios publicados en Traefik y certificados TLS próximos a expirar.
- [x] Añadir alertas de errores de despliegue y tareas fallidas recientes de Swarm.

**Resultado:** monitoreo integral.

---

## Fase 8 — Seguridad y mantenimiento

Estado: **parcial** (respaldos, auditoría operativa limitada y actualización manual de VPS Manager desde GitHub; faltan roles y recuperación)

- [x] Crear respaldos PostgreSQL cifrados, manuales y programados con retención de siete días.
- [x] Configurar intervalo automático entre 1 y 168 horas (24 horas por defecto).
- [x] Restaurar respaldos tras confirmar la acción y validar la autenticidad antes de modificar PostgreSQL.
- [x] Conservar el directorio persistente y el secreto de cifrado durante la desinstalación normal.
- [x] Registrar cambios de configuración y respaldos; mostrar los últimos 100 eventos al administrador.
- [ ] Roles.
- [ ] MFA.
- [x] Consultar releases estables de GitHub y permitir iniciar desde el panel una actualización verificada mediante un servicio host limitado; conservar alternativa manual por SSH.
- [x] Mostrar diagnóstico bajo demanda desde el panel para Docker, Swarm, servicios, redes, PostgreSQL y respaldos; conservar el comando SSH para información del host.
- [ ] Recuperación automática.

**Resultado:** plataforma preparada para producción.
