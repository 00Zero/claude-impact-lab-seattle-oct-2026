// Single-file artifact build of the same source the Next.js app uses.
// Always runs on the isolated development fixtures and simulators.
import { createRoot } from "react-dom/client";
import { createFixtureServices } from "@/lib/services/fixtureServices";
import { ExplorerApp } from "@/explorer/ExplorerApp";

createRoot(document.getElementById("root")!).render(<ExplorerApp services={createFixtureServices()} />);
