import { useEffect, useRef, useState } from 'react';
import PlayingCard from './PlayingCard';

// ─── Feature flag: set false to revert to 3×2 grid ───────────────────────
const USE_OVAL_TABLE = true;

// Grid fallback: CO | HJ | UTG (far) / BTN | BB | SB (near, hero centered)
const TABLE_DISPLAY_ORDER = [2, 1, 0, 3, 5, 4];

// Oval table: natural clockwise seat angles; hero is rotated to always sit at the bottom.
// Positions array = [UTG(0), HJ(1), CO(2), BTN(3), SB(4), BB(5)]
const BASE_SEAT_ANGLES = [180, 240, 300, 0, 60, 120];

// ─── Hand name derivation ──────────────────────────────────────────────────

const RANK_NAMES = {
  'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack',
  'T': 'Ten', '9': 'Nine', '8': 'Eight', '7': 'Seven',
  '6': 'Six', '5': 'Five', '4': 'Four', '3': 'Three', '2': 'Two',
};

function getHandName(hand) {
  const [c1, c2] = hand;
  const r1 = c1.r; const r2 = c2.r;
  const suited = c1.s === c2.s;
  if (r1 === r2) return `Pocket ${RANK_NAMES[r1]}s`;
  return `${RANK_NAMES[r1]}-${RANK_NAMES[r2]} ${suited ? 'Suited' : 'Offsuit'}`;
}

const POSITION_INFO = {
  'UTG': 'Under the Gun · First to act',
  'HJ':  'Hijack · Middle position',
  'CO':  'Cutoff · Strong position',
  'BTN': 'Button · Best position',
  'SB':  'Small Blind · Out of position',
  'BB':  'Big Blind · Closes preflop action',
};

// ─── Timer Ring ────────────────────────────────────────────────────────────
// Owns its own countdown so the 1-second tick re-renders only the ring, not
// the whole app tree. Remounted per scenario via key; frozen via `paused`.

function TimerRing({ totalSeconds, paused, onTimeout }) {
  const [seconds, setSeconds] = useState(totalSeconds);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; });

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(id);
          onTimeoutRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - seconds / totalSeconds);
  const color = seconds <= 10 ? 'var(--red)' : seconds <= 30 ? 'var(--yellow)' : 'var(--green)';
  return (
    <div style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
      <svg width="42" height="42" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="21" cy="21" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="21" cy="21" r={radius} fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease', filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: '13px', fontWeight: '700',
        color, transition: 'color 0.5s ease',
      }}>{seconds}</div>
    </div>
  );
}

// ─── Street indicator bar ─────────────────────────────────────────────────

const STREET_NAMES = ['Preflop', 'Flop', 'Turn', 'River'];

function StreetBar({ boardLength }) {
  const current = boardLength === 0 ? 0 : boardLength === 3 ? 1 : boardLength === 4 ? 2 : 3;
  return (
    <div className="street-bar">
      {STREET_NAMES.map((name, i) => (
        <div key={name} className="street-item">
          {i > 0 && <span className="street-sep" />}
          <span className={`street-pip${i < current ? ' street-past' : i === current ? ' street-current' : ''}`}>
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Action trail (decision panel) ───────────────────────────────────────

const THREAT_RE = /^(Bets?|Raises?|Check.Raises?|3.Bets?|4.Bets?|Donks?|All.?[Ii]n)/i;
const CHECK_RE  = /^Checks?d?$/i;
const extractAmt = str => str?.match(/\$(\d[\d,]*)/)?.[1];

// Postflop acting order by seat index (SB=idx4 acts first, BTN=idx3 acts last)
// positions array: [UTG(0), HJ(1), CO(2), BTN(3), SB(4), BB(5)]
const POSTFLOP_ORDER = [2, 3, 4, 5, 0, 1];

export function buildActionTrail(scenario) {
  const villainIdx = scenario.positions.findIndex(p => p.state === 'active');
  if (villainIdx === -1) return null;

  const villain = scenario.positions[villainIdx];
  const pos = villain.label.split(' ')[0];
  const isPostflop = scenario.board && scenario.board.length > 0;
  const heroIdx = scenario.positions.findIndex(p => p.state === 'hero');
  // True when villain seats before hero in postflop acting order (villain bets/checks first)
  const villainActsFirst = heroIdx !== -1 &&
    POSTFLOP_ORDER[villainIdx] < POSTFLOP_ORDER[heroIdx];

  // Villain explicitly checked this street
  if (villain.action && CHECK_RE.test(villain.action)) {
    return { pos, action: 'checks' };
  }

  if (villain.action && THREAT_RE.test(villain.action)) {
    if (isPostflop) {
      const actionAmt = extractAmt(villain.action);
      const callAmt   = extractAmt(scenario.toCall);

      if (callAmt && actionAmt !== callAmt) {
        // Stale preflop raise stored; current bet is in toCall
        const amount = scenario.toCall.replace(/\s*more\s*/i, '').trim();
        return { pos, action: `bets ${amount}` };
      }

      if (!callAmt) {
        const callOpt = scenario.options.find(o => o.cls === 'call' && /^Call\s*\$/.test(o.label));
        const btnAmt  = callOpt?.label.match(/\$[\d,]+/)?.[0];
        if (btnAmt && actionAmt !== btnAmt.slice(1)) return { pos, action: `bets ${btnAmt}` };
        // No current bet — infer villain checked if they act before hero
        if (villainActsFirst) return { pos, action: 'checks' };
        return null;
      }
    }
    return { pos, action: villain.action };
  }

  // No explicit threat — derive from toCall or call button label
  if (scenario.toCall) {
    const amount = scenario.toCall.replace(/\s*more\s*/i, '').trim();
    return { pos, action: `bets ${amount}` };
  }

  const callOpt = scenario.options.find(o => o.cls === 'call' && /^Call\s*\$/.test(o.label));
  const btnAmt  = callOpt?.label.match(/\$[\d,]+/)?.[0];
  if (btnAmt) return { pos, action: `bets ${btnAmt}` };

  // No bet at all — infer villain checked if they act before hero
  if (isPostflop && villainActsFirst) return { pos, action: 'checks' };

  return null;
}

function ActionTrail({ scenario }) {
  const trail = buildActionTrail(scenario);
  if (!trail) return null;
  return (
    <div className="dp-action-trail">
      <div className="dp-at-label">Action to you</div>
      <div className="dp-at-steps">
        <span className="dp-at-pos">{trail.pos}</span>
        {' '}<span className="dp-at-act">{trail.action}</span>
      </div>
    </div>
  );
}


// ─── Oval table ───────────────────────────────────────────────────────────

function TableOval({ scenario, pot }) {
  const heroIdx = scenario.positions.findIndex(p => p.state === 'hero');
  const heroBase = BASE_SEAT_ANGLES[heroIdx] ?? 120;
  const offset = (180 - heroBase + 360) % 360;

  const cx = 150, cy = 110;
  const tableRx = 76, tableRy = 52;
  const orbitRx = 112, orbitRy = 78;

  const seats = scenario.positions.map((p, i) => {
    const angleDeg = ((BASE_SEAT_ANGLES[i] + offset) % 360 + 360) % 360;
    const rad = (angleDeg - 90) * (Math.PI / 180);
    const x = cx + orbitRx * Math.cos(rad);
    const y = cy + orbitRy * Math.sin(rad);
    const mag = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) || 1;
    return {
      pos: p.label.split(' ')[0],
      action: p.action,
      state: p.state,
      x, y,
      dirX: (x - cx) / mag,
      dirY: (y - cy) / mag,
    };
  });

  return (
    <svg viewBox="0 0 300 232" className="table-oval" aria-hidden="true">
      {/* Outer rail */}
      <ellipse cx={cx} cy={cy} rx={tableRx + 7} ry={tableRy + 7}
        fill="rgba(8,18,12,0.7)" stroke="rgba(160,120,40,0.45)" strokeWidth="3.5" />
      {/* Felt */}
      <ellipse cx={cx} cy={cy} rx={tableRx} ry={tableRy}
        fill="#163222" stroke="rgba(200,168,75,0.18)" strokeWidth="1" />
      {/* Inner subtle highlight */}
      <ellipse cx={cx} cy={cy - 3} rx={tableRx - 10} ry={tableRy - 8}
        fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />

      {/* Pot info centered on felt */}
      <text x={cx} y={cy - 6} textAnchor="middle"
        fontSize="7" fill="rgba(242,237,227,0.25)"
        fontFamily="JetBrains Mono, monospace" letterSpacing="1.5">
        POT
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        fontSize="20" fill="rgba(200,168,75,0.92)"
        fontFamily="JetBrains Mono, monospace" fontWeight="700">
        {pot}
      </text>

      {seats.map((s, i) => {
        const isHero   = s.state === 'hero';
        const isActive = s.state === 'active';
        const isFolded = s.state === 'folded';

        const circleFill   = isHero ? 'rgba(200,168,75,0.22)' : isActive ? 'rgba(46,204,113,0.16)' : 'rgba(12,26,18,0.95)';
        const circleStroke = isHero ? 'rgba(200,168,75,0.88)' : isActive ? 'rgba(46,204,113,0.65)' : 'rgba(255,255,255,0.13)';
        const strokeW      = isHero || isActive ? 1.8 : 1.1;
        const labelColor   = isHero ? '#e2c97e' : isActive ? '#2ecc71' : isFolded ? 'rgba(242,237,227,0.18)' : 'rgba(242,237,227,0.5)';

        // action text position: push away from center along the seat's direction
        const tx = s.x + s.dirX * 24;
        const ty = s.y + s.dirY * 24;

        return (
          <g key={i}>
            {/* Seat circle */}
            <circle cx={s.x} cy={s.y} r="18"
              fill={circleFill} stroke={circleStroke} strokeWidth={strokeW} />

            {/* Position label inside circle */}
            <text x={s.x} y={s.y + 4} textAnchor="middle"
              fontSize={s.pos.length > 2 ? '7.5' : '9.5'}
              fill={labelColor}
              fontFamily="JetBrains Mono, monospace" fontWeight="700" letterSpacing="0.3">
              {s.pos}
            </text>

            {/* Hero label */}
            {isHero && (
              <text x={tx} y={ty + 3} textAnchor="middle"
                fontSize="7" fill="rgba(226,198,106,0.6)"
                fontFamily="JetBrains Mono, monospace" letterSpacing="0.5">
                YOU
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Blank card placeholder ────────────────────────────────────────────────

function BlankCard({ small }) {
  return (
    <div className={`playing-card blank-card ${small ? 'sm' : ''}`}>
      <span className="c-rank" style={{ opacity: 0.18, fontSize: small ? '0.7rem' : '0.9rem' }}>—</span>
    </div>
  );
}

// ─── Table Visual (dark felt section) ─────────────────────────────────────

function TableVisual({ scenario }) {
  const isRed = (str) => str.includes('♥') || str.includes('♦');
  const boardCount = scenario.board ? scenario.board.length : 0;
  const blankCount = Math.max(0, 5 - boardCount);

  return (
    <div className="table-wrap">
      <StreetBar boardLength={boardCount} />

      {USE_OVAL_TABLE ? (
        <TableOval scenario={scenario} pot={scenario.pot} />
      ) : (
        <div className="positions-grid">
          {TABLE_DISPLAY_ORDER.map(idx => {
            const p = scenario.positions[idx];
            return (
              <div key={idx} className={`pos ${p.state}`}>
                <div className="pos-name">{p.label}</div>
                <div className="pos-action">{p.action}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Board — always show all 5 slots */}
      <div className="board-label">Board</div>
      <div className="board-row">
        {scenario.board && scenario.board.map((card, i) => (
          <PlayingCard key={i} rank={card.slice(0, -1)} suit={card.slice(-1)}
            color={isRed(card) ? 'red' : 'black'} animDelay={`${i * 0.12}s`} />
        ))}
        {Array.from({ length: blankCount }, (_, i) => (
          <BlankCard key={`blank-${i}`} />
        ))}
      </div>

      {/* Pot info — shown below table only in grid mode */}
      {!USE_OVAL_TABLE && (
        <div className="pot-info" style={{ fontSize: '0.85rem', letterSpacing: '0.08em', marginTop: '14px' }}>
          Pot: <span>{scenario.pot}</span>
          {scenario.toCall && <> &nbsp;·&nbsp; To call: <span>{scenario.toCall}</span></>}
        </div>
      )}

    </div>
  );
}

// ─── Session Progress ──────────────────────────────────────────────────────

function SessionProgress({ currentIndex, total, correctCount }) {
  return (
    <div className="session-progress">
      <span>Hand <strong>{currentIndex + 1}</strong> / {total}</span>
      <span className="progress-divider">·</span>
      <span><strong className="correct-count">{correctCount}</strong> correct</span>
    </div>
  );
}

// ─── Decision Panel (cream section) ───────────────────────────────────────

function DecisionPanel({ scenario, options, onDecision, decided }) {
  const heroPos = scenario.positions.find(p => p.state === 'hero')?.label?.split(' ')[0];
  const villainPos = scenario.positions.find(p => p.state === 'active')?.label?.split(' ')[0];

  return (
    <div className="decision-panel">

      {/* You Hold */}
      <div className="dp-you-hold">
        <div className="dp-you-hold-cards">
          {scenario.hand.map((card, i) => (
            <div key={i} className={`dp-mini-card ${card.c}`}>
              <span className="dp-mc-rank">{card.r}</span>
              <span className="dp-mc-suit">{card.s}</span>
            </div>
          ))}
        </div>
        <div className="dp-you-hold-info">
          <div className="dp-you-hold-label">You Hold</div>
          <div className="dp-name-row">
            <div className="dp-you-hold-name">{getHandName(scenario.hand)}</div>
            {POSITION_INFO[heroPos] && (
              <div className="dp-position-info">{POSITION_INFO[heroPos]}</div>
            )}
          </div>
        </div>
      </div>

      {/* Villain Read */}
      <div className="dp-villain-read">
        <div className="dp-vr-header">
          <span className="dp-vr-icon">⚑</span>
          <span className="dp-vr-label">Villain Read</span>
        </div>
        <div className="dp-name-row">
          <div className="dp-vr-name">{scenario.villain.label}</div>
          {POSITION_INFO[villainPos] && (
            <div className="dp-position-info">{POSITION_INFO[villainPos]}</div>
          )}
        </div>
      </div>

      {/* Action trail */}
      <ActionTrail scenario={scenario} />

      {/* Action header divider */}
      <div className="dp-action-header">Your Move</div>

      {/* Action buttons */}
      <div className="dp-actions">
        {options.map((opt) => (
          <button
            key={opt.val}
            className={`act-btn ${opt.cls}`}
            onClick={() => onDecision(opt.val)}
            disabled={decided}
          >
            <div className="act-icon">{opt.icon}</div>
            <div className="act-btn-content">
              <div className="act-btn-label">
                {opt.label.includes('(') ? opt.label.slice(0, opt.label.indexOf('(')).trim() : opt.label}
              </div>
              {opt.label.includes('(') && (
                <div className="act-btn-sublabel" style={{ color: '#1a1a1a' }}>
                  {opt.label.slice(opt.label.indexOf('(') + 1, opt.label.lastIndexOf(')'))}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

    </div>
  );
}

// ─── Scenario Card ─────────────────────────────────────────────────────────

export default function ScenarioCard({
  scenario, currentIndex, total,
  totalSeconds, correctCount,
  options, onDecision, decided,
  showTimer, onTimeout,
}) {
  return (
    <div className="scenario-card">
      {/* Dark header: skill tag + timer + progress */}
      <div className="card-meta">
        <div className="skill-tag">{scenario.tag}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {showTimer && (
            <TimerRing
              key={currentIndex}
              totalSeconds={totalSeconds}
              paused={decided}
              onTimeout={onTimeout}
            />
          )}
          <SessionProgress currentIndex={currentIndex} total={total} correctCount={correctCount} />
        </div>
      </div>

      {/* Dark felt (left) + cream Q&A (right) — side by side on tablet/desktop */}
      <div className="scenario-card-body">
        <TableVisual scenario={scenario} key={currentIndex} />
        <DecisionPanel
          scenario={scenario}
          options={options}
          onDecision={onDecision}
          decided={decided}
        />
      </div>
    </div>
  );
}