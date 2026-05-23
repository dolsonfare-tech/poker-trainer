export default function PlayingCard({ rank, suit, color, small, animDelay }) {
  return (
    <div
      className={`playing-card ${color} ${small ? 'sm' : ''} deal-in`}
      style={{ animationDelay: animDelay || '0s' }}
    >
      <span className="c-rank">{rank}</span>
      <span className="c-suit">{suit}</span>
    </div>
  );
}