import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PortfolioManagementDashboard from './App.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PortfolioManagementDashboard />
  </React.StrictMode>
)
