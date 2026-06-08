export default function PlayingCard({ rank, suit, color, small, animDelay }) {
  return (
    <div
      className={`playing-card ${color} ${small ? 'sm' : ''} deal-in`}
      style={{ animationDelay: animDelay || '0s' }}
    >
      <div className="c-corner c-tl">
        <span className="c-cr">{rank}</span>
        <span className="c-cs">{suit}</span>
      </div>
      <span className="c-center">{suit}</span>
      <div className="c-corner c-br">
        <span className="c-cr">{rank}</span>
        <span className="c-cs">{suit}</span>
      </div>
    </div>
  );
}