import { applicationCatalog } from "../data/application-catalog.mjs";

export default function ApplicationCatalog() {
  return (
    <div className="grid grid-cols-1 gap-[18px] min-[721px]:grid-cols-2" aria-label="Catálogo de aplicaciones">
      {applicationCatalog.filter((application) => !["n8n", "postgresql"].includes(application.id)).map((application) => (
        <section className="card application-card" aria-labelledby={`application-${application.id}`} key={application.id}>
          <div className="card-heading">
            <div>
              <p className="eyebrow">{application.category}</p>
              <h3 id={`application-${application.id}`}>{application.name}</h3>
            </div>
            <span className="badge roadmap-badge">{application.installation.statusLabel}</span>
          </div>
          <p className="muted">{application.description}</p>
          <ul className="roadmap-list">
            {application.features.map((feature) => <li key={feature}>{feature}</li>)}
          </ul>
          <p id="gitea-status" className="application-status" role="status" aria-live="polite">
            Consultando disponibilidad…
          </p>
          <p id="gitea-container-status" className="muted" role="status" aria-live="polite"></p>
          <p id="gitea-api-token-status" className="application-status hidden" role="status" aria-live="polite"></p>
          <p className="application-domain">
            <a id="gitea-url" href="#" className="update-release-link hidden">Abrir Gitea</a>
            <span id="gitea-ssh" className="muted hidden"></span>
          </p>
          <div className="container-heading-actions application-actions">
            <button id="install-gitea" className="button resource-action hidden" type="button" disabled={!application.installation.enabled}>
              Instalar Gitea
            </button>
            <button id="restart-gitea" className="button secondary resource-action hidden" type="button">
              Reiniciar contenedor
            </button>
            <button id="reveal-gitea-credentials" className="button secondary resource-action hidden" type="button">
              Mostrar credenciales una vez
            </button>
          </div>
          <form id="gitea-token-form" className="gitea-form hidden">
            <label htmlFor="gitea-api-token">Token de acceso de Gitea</label>
            <input id="gitea-api-token" name="token" type="password" autoComplete="new-password" minLength="20" maxLength="512" required />
            <p className="muted">Crea en Gitea un token con permiso de lectura de cuenta y escritura de repositorios. El token se valida y se guarda como secreto Swarm; no se almacena en la base de datos.</p>
            <button className="button secondary" type="submit">Conectar o actualizar token</button>
          </form>
          <form id="gitea-repository-form" className="gitea-form hidden">
            <h4>Crear repositorio privado</h4>
            <label htmlFor="gitea-repository-name">Nombre</label>
            <input id="gitea-repository-name" name="name" type="text" pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,99}" maxLength="100" required />
            <label htmlFor="gitea-repository-description">Descripción (opcional)</label>
            <input id="gitea-repository-description" name="description" type="text" maxLength="500" />
            <p id="gitea-repository-status" className="muted" role="status" aria-live="polite"></p>
            <button className="button" type="submit">Crear repositorio</button>
          </form>
          <div id="gitea-repository-result" className="gitea-form gitea-repository-result hidden" aria-live="polite"></div>
          <section id="gitea-branch-management" className="gitea-form hidden" aria-labelledby="gitea-branch-title">
            <h4 id="gitea-branch-title">Administrar ramas</h4>
            <label htmlFor="gitea-branch-repository">Repositorio</label>
            <select id="gitea-branch-repository" name="repository">
              <option value="">Selecciona un repositorio</option>
            </select>
            <button id="gitea-branch-refresh" className="button secondary" type="button">Consultar ramas</button>
            <button id="gitea-webhook-configure" className="button secondary" type="button" disabled>
              Configurar webhook de push
            </button>
            <p id="gitea-webhook-status" className="muted" role="status" aria-live="polite"></p>
            <form id="gitea-default-branch-form" className="gitea-form">
              <label htmlFor="gitea-default-branch">Rama predeterminada</label>
              <select id="gitea-default-branch" name="branch" disabled>
                <option value="">Primero consulta las ramas</option>
              </select>
              <p id="gitea-branch-status" className="muted" role="status" aria-live="polite"></p>
              <button id="gitea-default-branch-submit" className="button" type="submit" disabled>Cambiar rama predeterminada</button>
            </form>
          </section>
        </section>
      ))}
      <section className="card application-card" aria-labelledby="application-postgresql">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Base de datos</p>
            <h3 id="application-postgresql">PostgreSQL</h3>
          </div>
          <span className="badge roadmap-badge">Aplicación opcional</span>
        </div>
        <p className="muted">Base de datos relacional privada para tus aplicaciones desplegadas en Swarm.</p>
        <ul className="roadmap-list">
          <li>Instancia única con volumen persistente administrado</li>
          <li>Acceso interno por la red Swarm en vps-manager-postgresql:5432</li>
          <li>Contraseña generada automáticamente y almacenada como secreto Swarm</li>
          <li>Sin puertos publicados en el VPS</li>
        </ul>
        <p id="postgresql-status" className="application-status" role="status" aria-live="polite">
          Consultando disponibilidad…
        </p>
        <div className="container-heading-actions application-actions">
          <button id="install-postgresql" className="button resource-action hidden" type="button">Instalar PostgreSQL</button>
          <button id="reveal-postgresql-credentials" className="button secondary resource-action hidden" type="button">
            Mostrar credenciales una vez
          </button>
        </div>
      </section>
      <section className="card application-card" aria-labelledby="application-supabase">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Backend e infraestructura</p>
            <h3 id="application-supabase">Supabase</h3>
          </div>
          <span className="badge roadmap-badge">Configuración por VPS</span>
        </div>
        <p className="muted">Define una instalación self-hosted completa por servidor Swarm, con API y Studio bajo dominios HTTPS independientes.</p>
        <ul id="supabase-services" className="roadmap-list">
          <li>Consultando servicios y versiones del catálogo…</li>
        </ul>
        <details className="application-settings">
          <summary>Servicios, volúmenes y secretos</summary>
          <div id="supabase-settings-summary" className="application-settings-summary"></div>
        </details>
        <p id="supabase-status" className="application-status" role="status" aria-live="polite">
          Consultando catálogo y servidores Swarm…
        </p>
        <div id="supabase-instances" className="resource-list"></div>
        <div className="container-heading-actions application-actions">
          <button id="configure-supabase" className="button resource-action" type="button" disabled>
            Configurar Supabase por servidor
          </button>
        </div>
      </section>
      <section className="card application-card" aria-labelledby="application-n8n">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Automatización</p>
            <h3 id="application-n8n">n8n</h3>
          </div>
          <span className="badge roadmap-badge">Aplicación opcional</span>
        </div>
        <p className="muted">Automatiza flujos de trabajo con una instancia privada y persistente.</p>
        <ul className="roadmap-list">
          <li>Instancia única con SQLite y volumen persistente administrado</li>
          <li>Acceso HTTPS con dominio registrado como aplicación n8n en Dominios</li>
          <li>Clave de cifrado generada automáticamente y guardada como secreto Swarm</li>
        </ul>
        <p id="n8n-status" className="application-status" role="status" aria-live="polite">
          Consultando disponibilidad…
        </p>
        <p className="application-domain">
          <a id="n8n-url" href="#" className="update-release-link hidden">Abrir n8n</a>
        </p>
        <div className="container-heading-actions application-actions">
          <button id="install-n8n" className="button resource-action hidden" type="button">Instalar n8n</button>
        </div>
      </section>
    </div>
  );
}
