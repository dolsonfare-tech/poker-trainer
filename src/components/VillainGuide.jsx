import { useState } from 'react';

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
  { label: 'CO — Cutoff', desc: 'One seat right of the Button, second best position — you act last preflop if the BTN folds and nearly last postflop.' },
  { label: 'HJ — Hijack', desc: 'Two seats right of the Button — decent position with three players still to act behind you preflop.' },
  { label: 'UTG — Under the Gun', desc: "First to act preflop, the worst position — you have no information about anyone else's hand when you make your decision." },
  { label: 'SB — Small Blind', desc: 'Posts half the big blind and acts first on every postflop street — the worst position postflop despite acting late preflop.' },
  { label: 'BB — Big Blind', desc: 'Posts the full big blind, acts last preflop, and acts second on every postflop street — better than SB but still out of position most of the time.' },
];

export default function VillainGuide({ onClose }) {
  const [activeTab, setActiveTab] = useState('players');

  const items = activeTab === 'players' ? VILLAINS : activeTab === 'positions' ? POSITIONS : GLOSSARY;

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
          <button className={`vg-tab ${activeTab === 'positions' ? 'active' : ''}`} onClick={() => setActiveTab('positions')}>Positions</button>
          <button className={`vg-tab ${activeTab === 'glossary' ? 'active' : ''}`} onClick={() => setActiveTab('glossary')}>Glossary</button>
        </div>

        <div className="vg-list">
          {items.map((item, i) => (
            <div key={i} className="vg-item">
              <div className="vg-item-label">{item.label}</div>
              <div className="vg-item-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
