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
        </section>
      ))}
    </div>
  );
}
