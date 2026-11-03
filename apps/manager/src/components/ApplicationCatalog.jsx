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
          <p className="application-status" role="status">
            La instalación automática y la detección de estado aún no están disponibles.
          </p>
        </section>
      ))}
    </div>
  );
}
