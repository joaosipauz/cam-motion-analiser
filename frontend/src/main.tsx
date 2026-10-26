import { createRoot } from "react-dom/client";
// fontes empacotadas: o app funciona offline e não consulta servidores externos
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
