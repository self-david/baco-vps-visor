export const applicationCatalog = [
  {
    id: "gitea",
    name: "Gitea",
    category: "Control de versiones",
    description: "Servidor Git privado para alojar repositorios y conectar proyectos.",
    features: [
      "Repositorios y ramas Git",
      "Acceso web mediante HTTPS en git.<dominio>",
      "Conexiones Git SSH por el puerto 2222",
      "Integración futura con proyectos y webhooks",
    ],
    installation: {
      status: "optional",
      enabled: true,
      statusLabel: "Aplicación opcional",
    },
  },
];
