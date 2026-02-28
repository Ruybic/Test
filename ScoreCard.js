import React from 'react';

function ScoreCard({ score }) {
  // Logic to determine rank color
  const rankClass = `rank-grade rank-${score.rank}`;

  return (
    <div className="score-card">
      <div className="pp-value">{Math.round(score.pp)}pp</div>
      <div className={rankClass}>{score.rank}</div>
      
      <div 
        className="map-header" 
        style={{ backgroundImage: `url(${score.beatmapset.cover})` }}
      >
        <div className="star-rating">★ {score.beatmapset.difficulty_rating}</div>
      </div>

      <div className="card-body">
        <a href={`https://osu.ppy.sh/users/${score.user_id}`} className="player-name">
          {score.user}
        </a>
        <div className="map-title">{score.beatmapset.title}</div>
        <div className="score-stats">
          <span className="accuracy">{(score.accuracy * 100).toFixed(2)}%</span>
          <span className="time-ago">Today</span>
        </div>
      </div>
    </div>
  );
}

export default ScoreCard;
