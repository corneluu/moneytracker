window.onerror = function(msg, url, line, col, error) {
  alert("FATAL ERROR: " + msg + "\nAt: " + url + ":" + line);
  return false;
};

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
