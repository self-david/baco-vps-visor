import { applicationCatalog } from "../data/application-catalog.mjs";

export default function ApplicationCatalog() {
  return (
    <div className="grid grid-cols-1 gap-[18px] min-[721px]:grid-cols-2" aria-label="Catálogo de aplicaciones">
      {applicationCatalog.map((application) => (
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
          <p id="gitea-api-token-status" className="application-status hidden" role="status" aria-live="polite"></p>
          <p className="application-domain">
            <a id="gitea-url" href="#" className="update-release-link hidden">Abrir Gitea</a>
            <span id="gitea-ssh" className="muted hidden"></span>
          </p>
          <div className="container-heading-actions application-actions">
            <button id="install-gitea" className="button resource-action hidden" type="button" disabled={!application.installation.enabled}>
              Instalar Gitea
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
    </div>
  );
}
