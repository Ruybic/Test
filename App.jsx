import React, { useState, useEffect } from 'react';
import Header from './Header';       // No 'components/' folder!
import ScoreCard from './ScoreCard'; // No 'components/' folder!
import './App.css'; 

function App() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("2026-02-27");

  useEffect(() => {
    // This is the "Build" logic moving to the browser
    const [year, month, day] = selectedDate.split('-');
    fetch('.data/${year}/${month}/${day}.json`)
      .then(res => res.json())
      .then(data => {
        setScores(data.scores);
        setLoading(false);
      })
      .catch(err => {
        console.error("No scores found");
        setLoading(false);
      });
  }, [selectedDate]);

  return (
    <div className="app-container">
      <Header />
      
      <div className="controls-bar">
        <span className="section-label">DATE: {selectedDate}</span>
        <button className="date-btn">📅 SELECT DATE</button>
      </div>

      <div className="feed-container">
        <div className="score-grid">
          {loading ? (
            <div className="status-msg">Loading Iraqi Scores...</div>
          ) : (
            scores.map(score => (
              <ScoreCard key={score.score_id} score={score} />
            ))
          )}
        </div>
      </div>

      <footer>
        {/* Your footer HTML goes here */}
      </footer>
    </div>
  );
}

export default App;
