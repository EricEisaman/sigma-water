import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function initAnalytics(): void {
	const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
	const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined;

	if (!endpoint || !websiteId) {
		return;
	}

	const normalizedEndpoint = endpoint.replace(/\/$/, "");
	const script = document.createElement("script");
	script.defer = true;
	script.src = `${normalizedEndpoint}/umami`;
	script.setAttribute("data-website-id", websiteId);
	document.head.appendChild(script);
}

initAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
