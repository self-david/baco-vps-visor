import assert from "node:assert/strict";
import test from "node:test";
import { getSupabaseRuntimeServices } from "../supabase-runtime.mjs";

test("reports installed and running Supabase services from owned Docker containers", () => {
  const instance = {
    id: "d909f79b-e7f9-41e7-9e7a-6ea000000001",
    configuration: { enabledServices: ["db", "studio", "api-gw", "auth", "rest", "meta"] },
  };
  const containers = [
    {
      State: "running",
      Status: "Up 3 minutes",
      Labels: {
        "vps-manager.application": "supabase",
        "vps-manager.instance-id": instance.id,
        "vps-manager.component": "supabase-db",
      },
    },
    {
      State: "exited",
      Status: "Exited (1) 2 minutes ago",
      Labels: {
        "vps-manager.application": "supabase",
        "vps-manager.instance-id": instance.id,
        "vps-manager.component": "supabase-studio",
      },
    },
    {
      State: "running",
      Status: "Up",
      Labels: {
        "vps-manager.application": "supabase",
        "vps-manager.instance-id": "different-instance",
        "vps-manager.component": "supabase-auth",
      },
    },
  ];

  const services = getSupabaseRuntimeServices(instance, containers);
  assert.deepEqual(services.find((service) => service.id === "db"), {
    id: "db",
    enabled: true,
    installed: true,
    running: true,
    containers: 1,
    runningContainers: 1,
    status: "Up 3 minutes",
  });
  assert.equal(services.find((service) => service.id === "studio").installed, true);
  assert.equal(services.find((service) => service.id === "studio").running, false);
  assert.equal(services.find((service) => service.id === "auth").installed, false);
  assert.equal(services.find((service) => service.id === "vector").enabled, false);
});
