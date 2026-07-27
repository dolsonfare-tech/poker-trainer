import PlayingCard from '../PlayingCard';
import { villainSummary, relationLine } from '../../utils/ticker';
import getHandName from '../../utils/handName';
import { seatPercent, bubblePlacement } from './tableGeometry';

// ═══ Single-canvas table (sc2) ═════════════════════════════════════════════
// The felt itself: seats, villain bubble, pot, board, hero cards.
//
// ⚠ The `.sc2-table` width law — `.sc2-table` needs its explicit width:100% in
// App.css. `.sc2-stage` is a single-cell grid, and a grid item with
// `margin:0 auto` whose children are all absolutely positioned collapses to
// 0px wide without one; the table then renders as a vertical line while every
// functional test stays green. Screenshot the canvas after touching that CSS.

// ─── Blank card placeholder ────────────────────────────────────────────────

function BlankCard({ small }) {
  return (
    <div className={`playing-card blank-card ${small ? 'sm' : ''}`}>
      <span className="c-rank" style={{ opacity: 0.18, fontSize: small ? '0.7rem' : '0.9rem' }}>—</span>
    </div>
  );
}

export default function TableCanvas({ scenario, onVillainInfo }) {
  const positions = scenario.positions;
  const heroIdx = positions.findIndex(p => p.state === 'hero');
  const villainIdx = positions.findIndex(p => p.state === 'active');
  const v = villainSummary(scenario);
  const isRed = (str) => str.includes('♥') || str.includes('♦');
  const boardCount = scenario.board ? scenario.board.length : 0;
  const blankCount = Math.max(0, 5 - boardCount);
  const heroPos = positions[heroIdx]?.label?.split(' ')[0] ?? 'YOU';
  const anchor = villainIdx !== -1 ? seatPercent(villainIdx, heroIdx) : null;

  return (
    <div className="sc2-table">
      <div className="sc2-felt" />

      {positions.map((p, i) => {
        if (i === heroIdx) return null;
        const { x, y } = seatPercent(i, heroIdx);
        const cls = p.state === 'active' ? ' vill' : p.state === 'folded' ? ' folded' : '';
        return (
          <div key={i} className={`sc2-seat${cls}`} style={{ left: `${x}%`, top: `${y}%` }}>
            {p.label.split(' ')[0]}
          </div>
        );
      })}

      {v && anchor && (() => {
        const { bx, tail, dropPx } = bubblePlacement(anchor);
        return (
          <div
            className={`sc2-bubble${onVillainInfo ? ' sc2-bubble-tappable' : ''}`}
            style={{ left: `${bx}%`, top: `calc(${anchor.y}% + ${dropPx}px)` }}
            onClick={onVillainInfo ? () => onVillainInfo(v.label) : undefined}
            role={onVillainInfo ? 'button' : undefined}
            title={onVillainInfo ? `About the ${v.label}` : undefined}
          >
            <span className="sc2-bub-tail" style={{ left: `${tail}%` }} />
            <div className="sc2-bub-head">
              <span className="sc2-monogram">{v.monogram}</span>
              <span className="sc2-bub-name">{v.label}</span>
              {onVillainInfo && <span className="sc2-bub-info">ⓘ</span>}
            </div>
            <div className="sc2-bub-pos">{relationLine(v)}</div>
          </div>
        );
      })()}

      <div className="sc2-center">
        <div className="sc2-pot">
          <span className="sc2-pot-label">POT</span>
          <span className="sc2-pot-amt">{scenario.pot}</span>
        </div>
        <div className="sc2-board">
          {scenario.board && scenario.board.map((card, i) => (
            <PlayingCard key={i} rank={card.slice(0, -1)} suit={card.slice(-1)}
              color={isRed(card) ? 'red' : 'black'} animDelay={`${i * 0.12}s`} />
          ))}
          {Array.from({ length: blankCount }, (_, i) => (
            <BlankCard key={`blank-${i}`} />
          ))}
        </div>
      </div>

      <div className="sc2-hero">
        <div className="sc2-hero-cards">
          {scenario.hand.map((c, i) => (
            <PlayingCard key={i} rank={c.r} suit={c.s} color={c.c} animDelay={`${i * 0.1}s`} />
          ))}
        </div>
        <div className="sc2-hand-name">{getHandName(scenario.hand).toUpperCase()}</div>
        <span className="sc2-you-chip">
          {heroPos.toUpperCase() === 'YOU' ? 'YOU' : `${heroPos} · YOU`}
        </span>
      </div>
    </div>
  );
}
