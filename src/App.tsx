import React, { useState } from 'react';
import { Activity, Heart, Thermometer, AlertCircle } from 'lucide-react';

/**
 * Post-Operative Monitoring Dashboard
 * This component visualizes patient vitals and recovery trends.
 */
function App() {
  // Mock data for patient vitals
  const [vitals] = useState({
    heartRate: 72,
    temperature: 98.6,
    oxygen: 98,
    status: "Stable"
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#2c3e50' }}>MedAssist: Post-Op Monitor</h1>
        <p>Patient ID: #12345 | Recovery Day: 3</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        
        {/* Heart Rate Card */}
        <div className="card" style={cardStyle}>
          <Heart color="#e74c3c" />
          <h3>Heart Rate</h3>
          <p style={dataStyle}>{vitals.heartRate} <span style={{fontSize: '1rem'}}>BPM</span></p>
        </div>

        {/* Temperature Card */}
        <div className="card" style={cardStyle}>
          <Thermometer color="#f39c12" />
          <h3>Body Temp</h3>
          <p style={dataStyle}>{vitals.temperature}°F</p>
        </div>

        {/* Status Alert */}
        <div className="card" style={{...cardStyle, borderLeft: '10px solid #2ecc71'}}>
          <Activity color="#2ecc71" />
          <h3>Health Status</h3>
          <p style={{...dataStyle, color: '#2ecc71'}}>{vitals.status}</p>
        </div>

      </div>

      <section style={{ marginTop: '40px', padding: '20px', background: 'white', borderRadius: '8px' }}>
        <h3><AlertCircle size={20} /> Recovery Insights (AI Generated)</h3>
        <p>Patient's heart rate variability is within normal post-surgical limits. No immediate intervention required.</p>
      </section>
    </div>
  );
}

// Simple Inline Styles
const cardStyle: React.CSSProperties = {
  background: 'white',
  padding: '20px',
  borderRadius: '12px',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  textAlign: 'center'
};

const dataStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 'bold',
  margin: '10px 0'
};

export default App;
