import { useState } from 'react';
import { SKILL_NAMES, SKILL_DESCRIPTIONS, PLAYER_SCHEMAS } from '../data/constants';
import { BALANCED_SCHEMA } from '../utils/userStorage';

// The 8 measured skills, sourced from the shared constants so the guide can
// never drift from what the dashboard and rating engine use.
const SKILLS = Object.keys(SKILL_NAMES).map(key => ({
  label: SKILL_NAMES[key],
  desc: SKILL_DESCRIPTIONS[key],
}));

// Status names only — the accuracy thresholds behind them are engine
// internals, not something players need to be told.
const SKILL_RATINGS = [
  { key: 'red',    sym: '▼', label: 'Weak' },
  { key: 'yellow', sym: '◆', label: 'Work On' },
  { key: 'green',  sym: '●', label: 'Strong' },
  { key: 'gray',   sym: '○', label: 'Unrated' },
];

const VILLAINS = [
  { label: 'Tight Nit', desc: 'Only plays premium hands from any position. If they bet or raise, they almost always have it — never bluff them off a hand.' },
  { label: 'Calling Station', desc: 'Calls everything down with any pair or draw. Bluffing is useless — bet big for value and never try to make them fold.' },
  { label: 'Maniac', desc: 'Raises and re-raises constantly with a wide range including bluffs. Let them bluff into you and trap with strong hands.' },
  { label: 'Aggressive Regular', desc: "Skilled and unpredictable — applies pressure with both value and bluffs. Respect their bets but don't over-fold." },
  { label: 'Passive Player', desc: 'Checks and calls rather than betting or raising. When they do bet, take it seriously — it usually means a strong hand.' },
  { label: 'Loose Recreational', desc: 'Plays too many hands and chases draws. Bet for value liberally and avoid fancy bluffs — they call too wide to fold.' },
  { label: 'Tight Recreational', desc: "Plays few hands but lacks the skill to fold once they're in. Easy to read but hard to get value from when they fold pre." },
  { label: 'Unknown', desc: 'No read yet — play solid fundamentals, take notes on their tendencies, and adjust once you have a sample size.' },
];

// Schema content comes from the shared definitions the diagnosis engine
// uses — the guide can never drift from what the dashboard diagnoses.
const SCHEMAS = PLAYER_SCHEMAS.map(({ name, quote, desc }) => ({ label: name, quote, desc }));

const GLOSSARY = [
  { label: 'C-bet (Continuation Bet)', desc: 'A bet made by the player who raised before the flop, continuing to show aggression on the flop even if it missed their hand.' },
  { label: '3-bet', desc: 'A re-raise over someone who has already raised — the third bet in the sequence.' },
  { label: '4-bet', desc: 'A re-raise over a 3-bet — the fourth bet in the sequence, usually representing a very strong hand.' },
  { label: 'Open Raise', desc: 'The first raise preflop when no one has entered the pot yet.' },
  { label: 'Pot Odds', desc: 'The ratio of the current pot size to the cost of calling — used to decide if chasing a draw is mathematically profitable.' },
  { label: 'Fold Equity', desc: 'The added value of a bet or raise that comes from the chance your opponent will fold, giving you the pot without a showdown.' },
  { label: 'Range', desc: 'The full set of hands a player could have in a given situation, rather than one specific hand.' },
  { label: 'Position', desc: 'Where you sit relative to the dealer button. BTN (Button) acts last and has the most advantage. CO (Cutoff) is one seat right of BTN. HJ (Hijack) is two seats right. UTG (Under the Gun) acts first preflop. SB (Small Blind) and BB (Big Blind) act last preflop but first postflop.' },
  { label: 'Check-raise', desc: 'Checking when it is your turn, then raising after your opponent bets — a deceptive move used with strong hands or as a bluff.' },
  { label: 'Value Bet', desc: 'A bet made with a strong hand to get called by weaker hands and win more money.' },
  { label: 'Bluff', desc: 'A bet or raise made with a weak hand to make your opponent fold a better hand.' },
  { label: 'Donk Bet', desc: 'A bet made out of position into the player who had the betting initiative — considered unusual and often signals a strong hand or a mistake.' },
  { label: 'Slow Play', desc: 'Playing a strong hand passively by checking or calling instead of betting, to disguise its strength and trap your opponent.' },
  { label: 'ICM', desc: 'Independent Chip Model — a tournament concept where chip value is not linear, so decisions near the money or final table require extra caution.' },
];

const POSITIONS = [
  { label: 'BTN — Button', desc: 'The best seat at the table — you act last on every postflop street, giving you maximum information before making a decision.' },
  { label: 'SB — Small Blind', desc: 'Posts half the big blind and acts first on every postflop street — the worst position postflop despite acting late preflop.' },
  { label: 'BB — Big Blind', desc: 'Posts the full big blind, acts last preflop, and acts second on every postflop street — better than SB but still out of position most of the time.' },
  { label: 'UTG — Under the Gun', desc: "First to act preflop, the worst position — you have no information about anyone else's hand when you make your decision." },
  { label: 'HJ — Hijack', desc: 'Two seats right of the Button — decent position with three players still to act behind you preflop.' },
  { label: 'CO — Cutoff', desc: 'One seat right of the Button, second best position — you act last preflop if the BTN folds and nearly last postflop.' },
];

// ─── Position diagram ─────────────────────────────────────────────────────

const SEAT_ANGLES = [
  { key: 'BTN', angle: 0   },
  { key: 'SB',  angle: 60  },
  { key: 'BB',  angle: 120 },
  { key: 'UTG', angle: 180 },
  { key: 'HJ',  angle: 240 },
  { key: 'CO',  angle: 300 },
];

function PositionDiagram() {
  const cx = 105, cy = 82, rx = 72, ry = 50;
  const seats = SEAT_ANGLES.map(({ key, angle }) => {
    const rad = (angle - 90) * (Math.PI / 180);
    return {
      key,
      x:  cx + rx * Math.cos(rad),
      y:  cy + ry * Math.sin(rad),
      ix: cx + (rx - 22) * Math.cos(rad),
      iy: cy + (ry - 18) * Math.sin(rad),
    };
  });

  return (
    <svg viewBox="0 0 210 164" className="pos-diagram" aria-hidden="true">
      {/* Table felt */}
      <ellipse cx={cx} cy={cy} rx={rx - 22} ry={ry - 18}
        fill="rgba(27,61,42,0.85)" stroke="rgba(200,168,75,0.25)" strokeWidth="1.5" />
      <text x={cx} y={cy + 5} textAnchor="middle"
        fontSize="7" fill="rgba(242,237,227,0.18)"
        fontFamily="JetBrains Mono, monospace" letterSpacing="2">
        6-MAX
      </text>

      {seats.map(s => (
        <g key={s.key}>
          {/* Connector line from seat to table edge */}
          <line x1={s.x} y1={s.y} x2={s.ix} y2={s.iy}
            stroke="rgba(200,168,75,0.1)" strokeWidth="1" />

          {/* Seat circle */}
          <circle cx={s.x} cy={s.y} r="13"
            fill="rgba(14,32,24,0.95)" stroke="rgba(200,168,75,0.35)" strokeWidth="1.2" />

          {/* Seat label */}
          <text x={s.x} y={s.y + 3.5} textAnchor="middle"
            fontSize={s.key === 'UTG' ? '5.5' : '6.5'}
            fill="rgba(226,198,106,0.85)"
            fontFamily="JetBrains Mono, monospace" fontWeight="700">
            {s.key}
          </text>

        </g>
      ))}
    </svg>
  );
}

export default function VillainGuide({ onClose }) {
  const [activeTab, setActiveTab] = useState('players');

  const items = activeTab === 'players' ? VILLAINS
    : activeTab === 'schemas' ? SCHEMAS
    : activeTab === 'skills' ? SKILLS
    : activeTab === 'positions' ? POSITIONS
    : GLOSSARY;

  const intro = activeTab === 'players'
    ? 'The opponents you face. Read how each one bets so you can adjust your play against them.'
    : activeTab === 'schemas'
    ? 'How the trainer diagnoses you. Each schema is the root belief behind your most common mistakes — your own leak, not an opponent.'
    : activeTab === 'skills'
    ? 'The eight skills the trainer measures. Each rating tracks your true accuracy across every hand that tests that skill.'
    : null;

  return (
    <div className="vg-overlay" onClick={onClose}>
      <div className="vg-panel" onClick={e => e.stopPropagation()}>
        <div className="vg-handle" />

        <div className="vg-header">
          <div className="vg-title">Reference Guide</div>
          <button className="vg-close" onClick={onClose}>✕</button>
        </div>

        <div className="vg-tabs">
          <button className={`vg-tab ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>Player Types</button>
          <button className={`vg-tab ${activeTab === 'schemas' ? 'active' : ''}`} onClick={() => setActiveTab('schemas')}>Schemas</button>
          <button className={`vg-tab ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>Skills</button>
          <button className={`vg-tab ${activeTab === 'positions' ? 'active' : ''}`} onClick={() => setActiveTab('positions')}>Positions</button>
          <button className={`vg-tab ${activeTab === 'glossary' ? 'active' : ''}`} onClick={() => setActiveTab('glossary')}>Glossary</button>
        </div>

        {intro && <p className="vg-intro">{intro}</p>}

        {activeTab === 'skills' && (
          <div className="vg-skill-legend">
            {SKILL_RATINGS.map(({ key, sym, label }) => (
              <div key={key} className="vg-skill-legend-row">
                <span className={`vg-skill-legend-sym vg-sym-${key}`}>{sym}</span>
                <span className="vg-skill-legend-text">{label}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'positions' && (
          <>
            <PositionDiagram />
            <p className="vg-positions-note">
              This app uses 6-max tables (6 seats). Full ring games (9 seats) add UTG+1, UTG+2, and a Lojack between UTG and HJ — the strategic concepts here transfer directly.
            </p>
          </>
        )}

        <div className="vg-list">
          {items.map((item, i) => (
            <div key={i} className="vg-item">
              <div className="vg-item-label">{item.label}</div>
              {item.quote && <div className="vg-item-quote">“{item.quote}”</div>}
              <div className="vg-item-desc">{item.desc}</div>
            </div>
          ))}
        </div>

        {activeTab === 'schemas' && (
          <p className="vg-positions-note">
            No single leak dominant? You'll show as <strong>{BALANCED_SCHEMA.name}</strong> — no one weakness is driving your mistakes.
          </p>
        )}
      </div>
    </div>
  );
}
