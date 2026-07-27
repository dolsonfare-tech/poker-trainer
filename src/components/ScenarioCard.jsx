import CanvasLayout from './scenario/CanvasLayout';

// ─── Scenario Card ─────────────────────────────────────────────────────────
// Entry point for the gameplay canvas. Every piece lives in ./scenario/*
// (MOD-004, Wave 2); this file is the thin wrapper App.jsx renders.

export default function ScenarioCard(props) {
  return <CanvasLayout {...props} />;
}

// Re-export shim (Wave 2): SituationTicker moved to ./scenario/SituationTicker.
// Kept for one release so any direct importer of the old path stays green —
// remove once nothing imports it from here.
export { default as SituationTicker } from './scenario/SituationTicker';
