import { createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import DashboardTabs from "../components/DashboardTabs.jsx";

const root = document.querySelector("#dashboard-tabs-root");
if (root) hydrateRoot(root, createElement(DashboardTabs));
