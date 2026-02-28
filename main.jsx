import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // Vite is smart enough to find App.jsx even if you don't type the extension here!

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
