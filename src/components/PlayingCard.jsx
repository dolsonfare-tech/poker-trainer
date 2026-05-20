export default function PlayingCard({ rank, suit, color, small }) {
  return (
    <div className={`playing-card ${color} ${small ? 'sm' : ''}`}>
      <span className="c-rank">{rank}</span>
      <span className="c-suit">{suit}</span>
    </div>
  );
}