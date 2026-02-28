import React from 'react';

function Header() {
  return (
    <header>
        <div className="logo-box">
            <a href="index.html">
                <img src="https://i.imgur.com/1YJfjH6.png" alt="osu! Iraq" />
                <span className="logo-text">Osu! Iraq Today</span>
            </a>
        </div>
        <div className="dropdown">
            <button className="dropbtn">Menu ▼</button>
        </div>
    </header>
  );
}

export default Header;
