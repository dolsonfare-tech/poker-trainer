import { useEffect, useRef, useState } from 'react';
import { SKILL_NAMES, SKILL_DESCRIPTIONS, PLAYER_SCHEMAS } from '../data/constants';
import { BALANCED_SCHEMA, STUDENT_SCHEMA } from '../utils/userStorage';
import { VILLAIN_LABELS } from '../data/scenarios';

// The 8 measured skills, sourced from the shared constants so the guide can
// never drift from what the dashboard and rating engine use.
// Built per-render so each card can carry the PLAYER'S current rating. Before
// July 27 2026 this tab showed a shape legend with nothing rated beneath it —
// a key for a chart that wasn't there (founder report). The symbols come from
// the same four groups the dashboard's SkillLedger uses, so the two surfaces
// cannot drift.
const buildSkills = (skills = {}) => Object.keys(SKILL_NAMES).map(key => ({
  label: SKILL_NAMES[key],
  desc: SKILL_DESCRIPTIONS[key],
  rating: skills?.[key]?.rating ?? 'gray',
}));

// Status names only — the accuracy thresholds behind them are engine
// internals, not something players need to be told.
const SKILL_RATINGS = [
  { key: 'red',    sym: '▼', label: 'Weak' },
  { key: 'yellow', sym: '◆', label: 'Work On' },
  { key: 'green',  sym: '●', label: 'Strong' },
  { key: 'gray',   sym: '○', label: 'Unrated' },
];
// Declared after SKILL_RATINGS on purpose: a const cannot be read before its
// initialiser runs, and hoisting this above the array is a TDZ crash at import.
const RATING_SYM = Object.fromEntries(SKILL_RATINGS.map(r => [r.key, r]));

// Descriptions keyed by the dealer's villain TYPE keys; labels come from
// VILLAIN_LABELS so the list can't drift from what the game actually deals.
// VILLAIN_ORDER is pedagogical (confusable pairs near each other), not the
// map's insertion order.
const VILLAIN_DESCS = {
  'nit': 'Only plays premium hands from any position. If they bet or raise, they almost always have it — never bluff them off a hand.',
  'calling-station': 'Calls everything down with any pair or draw. Bluffing is useless — bet big for value and never try to make them fold.',
  'maniac': 'Raises and re-raises constantly with a wide range including bluffs. Let them bluff into you and trap with strong hands.',
  'aggressive': "Skilled and unpredictable — applies pressure with both value and bluffs. Respect their bets but don't over-fold.",
  'passive': 'Checks and calls rather than betting or raising. When they do bet, take it seriously — it usually means a strong hand.',
  'loose': 'Plays too many hands and chases draws. Bet for value liberally and avoid fancy bluffs — they call too wide to fold.',
  'tight': "Plays few hands preflop, but once they connect with a flop they struggle to let go. Value-bet them firmly when you have them beat — and don't bluff a player who has finally made a hand.",
  'unknown': 'No read yet — play solid fundamentals, take notes on their tendencies, and adjust once you have a sample size.',
};
const VILLAIN_ORDER = ['nit', 'calling-station', 'maniac', 'aggressive', 'passive', 'loose', 'tight', 'unknown'];
Object.keys(VILLAIN_LABELS).forEach((k) => {
  if (!VILLAIN_DESCS[k]) console.warn(`VillainGuide: no description for villain type '${k}'`);
});
const VILLAINS = VILLAIN_ORDER
  .filter((k) => VILLAIN_LABELS[k])
  .map((k) => ({ label: VILLAIN_LABELS[k], desc: VILLAIN_DESCS[k] }));

// Schema content comes from the shared definitions the diagnosis engine
// uses — the guide can never drift from what the dashboard diagnoses.
const SCHEMAS = PLAYER_SCHEMAS.map(({ name, quote, desc }) => ({ label: name, quote, desc }));

const GLOSSARY = [
  { label: 'C-bet (Continuation Bet)', desc: 'A bet made by the player who raised before the flop, continuing to show aggression on the flop even if it missed their hand.' },
  { label: '3-bet', desc: 'A re-raise over someone who has already raised — the third bet in the sequence.' },
  { label: '4-bet', desc: 'A re-raise over a 3-bet — the fourth bet in the sequence, usually representing a very strong hand.' },
  { label: 'Open Raise', desc: 'The first raise preflop when no one has entered the pot yet.' },
  // Tester report (July 27 2026): a player hit "3.7:1" in a feedback panel and
  // could not tell what it meant — they read the decimal point as a second
  // colon ("3:7:1"). The entry defined the concept but never decoded the
  // NOTATION or how to turn it into a number you can act on. Both now here,
  // because every scenario's feedback text uses this format.
  { label: 'Pot Odds', desc: 'The price you are being offered to call, written as a ratio. "3.7:1" (three-point-seven to one) means you stand to win $3.70 for every $1 you put in — it is one ratio, not three numbers. To turn it into the share of the time you need to win, divide 1 by the ratio plus 1: at 3.7:1 you need to be right about 21% of the time, at 2:1 about 33%. Win more often than that and calling makes money over the long run.' },
  { label: 'Fold Equity', desc: 'The added value of a bet or raise that comes from the chance your opponent will fold, giving you the pot without a showdown.' },
  { label: 'Range', desc: 'The full set of hands a player could have in a given situation, rather than one specific hand.' },
  { label: 'Position', desc: 'Where you sit relative to the dealer button — the later you act, the more information you have. The Positions tab maps every seat.' },
  { label: 'Check-raise', desc: 'Checking when it is your turn, then raising after your opponent bets — a deceptive move used with strong hands or as a bluff.' },
  { label: 'Value Bet', desc: 'A bet made with a strong hand to get called by weaker hands and win more money.' },
  { label: 'Bluff', desc: 'A bet or raise made with a weak hand to make your opponent fold a better hand.' },
  { label: 'Donk Bet', desc: 'A bet made out of position into the player who had the betting initiative — considered unusual and often signals a strong hand or a mistake.' },
  { label: 'Slow Play', desc: 'Playing a strong hand passively by checking or calling instead of betting, to disguise its strength and trap your opponent.' },
  { label: 'Effective Stacks', desc: 'The smaller of the two stacks in a hand — the most either player can win or lose. The stakes row shows it on every hand (e.g. $200 EFFECTIVE).' },
  { label: 'Limp', desc: 'Just calling the big blind preflop instead of raising. Generally a weak play — raise or fold instead.' },
  { label: 'Equity', desc: "Your hand's share of the pot if the cards were run out right now — a hand with 40% equity wins the pot 40% of the time." },
  { label: 'Outs', desc: 'The unseen cards that improve your hand to a likely winner — a flush draw has nine outs, an open-ended straight draw eight, a gutshot four.' },
  { label: 'Gutshot', desc: 'An inside straight draw needing one exact rank to fill — four outs, half the outs of an open-ended draw.' },
  { label: 'Kicker', desc: 'The side card that breaks ties between matching hands — on an ace-high board, A♥K♦ beats A♠Q♣ because the king outkicks the queen.' },
  { label: 'Barrel', desc: 'Continuing to bet street after street as the aggressor — a second barrel on the turn, a third barrel on the river.' },
  { label: 'Overbet', desc: 'A bet larger than the pot. It polarizes the bettor: usually a very strong hand or a bluff, rarely anything in between.' },
  { label: 'Semi-bluff', desc: 'A bet or raise with a drawing hand — you can win two ways: everyone folds now, or your draw arrives when called.' },
  { label: 'Float', desc: 'Calling a bet with a weak hand, planning to take the pot away on a later street when the aggressor gives up.' },
  { label: 'Blocker', desc: 'A card in your hand that makes an opponent less likely to hold a certain hand — holding the A♠ blocks the nut flush on a spade board.' },
  { label: 'Implied Odds', desc: 'Money you expect to win on later streets if your draw hits. Good implied odds can make a call profitable even when the immediate pot odds fall short.' },
  { label: 'Wet / Dry Board', desc: 'A wet board offers many draws (9♥8♥7♦); a dry board offers few (K♠7♦2♣). Wet boards call for bigger bets and closer attention.' },
];

const POSITIONS = [
  { label: 'BTN — Button', desc: 'The best seat at the table — you act last on every postflop street, giving you maximum information before making a decision.' },
  { label: 'SB — Small Blind', desc: 'Posts half the big blind and acts first on every postflop street — the worst position postflop despite acting late preflop.' },
  { label: 'BB — Big Blind', desc: 'Posts the full big blind and acts last preflop — but postflop you act first unless the Small Blind is still in the hand. Out of position most of the time.' },
  { label: 'UTG — Under the Gun', desc: "First to act preflop, the worst position — you have no information about anyone else's hand when you make your decision." },
  { label: 'HJ — Hijack', desc: 'Two seats right of the Button — decent position, but four players (CO, BTN, and both blinds) still act behind you preflop.' },
  { label: 'CO — Cutoff', desc: 'One seat right of the Button, second-best position — postflop, only the Button acts after you.' },
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

// `focus` (a villain label like "Tight Nit", or a schema name like "The
// The Resulter") opens the guide scrolled to and highlighting that item;
// `initialTab` picks the starting tab (the dashboard schema card opens
// 'schemas'; the villain read on the table opens the default 'players').
export default function VillainGuide({ onClose, focus, initialTab, skills }) {
  const [activeTab, setActiveTab] = useState(initialTab ?? 'players');
  const focusRef = useRef(null);

  useEffect(() => {
    if (focus && focusRef.current) {
      focusRef.current.scrollIntoView?.({ block: 'center' });
    }
  }, [focus]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = activeTab === 'players' ? VILLAINS
    : activeTab === 'schemas' ? SCHEMAS
    : activeTab === 'skills' ? buildSkills(skills)
    : activeTab === 'positions' ? POSITIONS
    : GLOSSARY;

  const intro = activeTab === 'players'
    ? 'The opponents you face. Read how each one bets so you can adjust your play against them.'
    : activeTab === 'schemas'
    ? 'How the trainer diagnoses you. Each schema is the root belief behind your most common mistakes — your own leak, not an opponent.'
    : activeTab === 'skills'
    ? 'The eight skills the trainer measures, with your current rating on each. Ratings track your true accuracy across every hand that tests that skill.'
    : null;

  return (
    <div className="vg-overlay" onClick={onClose}>
      <div className="vg-panel" onClick={e => e.stopPropagation()}>
        <div className="vg-handle" />

        <div className="vg-header">
          <div className="vg-title">Reference Guide</div>
          <button className="vg-close" aria-label="Close guide" onClick={onClose}>✕</button>
        </div>

        <div className="vg-tabs">
          {/* Named to match the in-game "Villain Read" label a tapping player
              is coming from (founder, July 20, 2026). */}
          <button className={`vg-tab ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>Villains</button>
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
          {items.map((item, i) => {
            const focused = (activeTab === 'players' || activeTab === 'schemas') && focus === item.label;
            return (
              <div
                key={i}
                ref={focused ? focusRef : undefined}
                className={`vg-item${focused ? ' vg-item-focus' : ''}`}
              >
                <div className="vg-item-label">
                  {item.rating && (
                    <span
                      className={`vg-item-rating vg-sym-${item.rating}`}
                      title={RATING_SYM[item.rating]?.label}
                    >{RATING_SYM[item.rating]?.sym}</span>
                  )}
                  {item.label}
                </div>
                {item.quote && <div className="vg-item-quote">“{item.quote}”</div>}
                <div className="vg-item-desc">{item.desc}</div>
              </div>
            );
          })}
        </div>

        {activeTab === 'schemas' && (
          <p className="vg-positions-note">
            No single leak dominant? You'll show as <strong>{BALANCED_SCHEMA.name}</strong> when
            most of your rated skills are strong — no one weakness is driving your mistakes —
            or <strong>{STUDENT_SCHEMA.name}</strong> while your whole game is still developing.
          </p>
        )}
      </div>
    </div>
  );
}
