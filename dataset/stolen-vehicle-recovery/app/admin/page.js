"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState('livefeed');
  const [reportedVehicles, setReportedVehicles] = useState([]);
  const [detectedVehicles, setDetectedVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [trackingVehicle, setTrackingVehicle] = useState(null);
  const [simulationData, setSimulationData] = useState([]);
  const [rtoRecords, setRtoRecords] = useState([]);
  const [revealedPhones, setRevealedPhones] = useState(new Set());
  const [streamState, setStreamState] = useState('waiting'); // 'waiting', 'running', 'finished'
  const [liveData, setLiveData] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [rtoSearch, setRtoSearch] = useState('');
  
  const liveFeedRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'livefeed' && streamState === 'running' && liveFeedRef.current) {
      liveFeedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeTab, streamState]);

  const filteredReported = reportedVehicles.filter(v => v.plateNumber.toLowerCase().includes(globalSearch.toLowerCase()));
  const filteredDetected = detectedVehicles.filter(v => v.plateNumber.toLowerCase().includes(globalSearch.toLowerCase()));
  const filteredRto = rtoRecords.filter(v => v.plateNumber.toLowerCase().includes(rtoSearch.toLowerCase()));

  const togglePhone = (id) => {
    setRevealedPhones(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/vehicles');
      const data = await res.json();
      if (data.success) {
        setReportedVehicles(data.reported);
        setDetectedVehicles(data.detected);
      }
      
      const rtoRes = await fetch('/api/rto');
      const rtoData = await rtoRes.json();
      if (rtoData.success) {
        setRtoRecords(rtoData.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let pingInterval;
    let dataInterval;
    if (streamState === 'running') {
      pingInterval = setInterval(async () => {
        try {
          await fetch('http://127.0.0.1:5001/ping');
        } catch (err) {
          // Connection refused means server shut down
          setStreamState('finished');
        }
      }, 1000); // Check every second
      
      dataInterval = setInterval(async () => {
        try {
          const res = await fetch('http://127.0.0.1:5001/live_data');
          if (res.ok) {
            const data = await res.json();
            setLiveData(data);
          }
        } catch (e) {
          // ignore
        }
      }, 250); // Poll fast for responsive UI
    }
    return () => {
      clearInterval(pingInterval);
      clearInterval(dataInterval);
    };
  }, [streamState]);

  // Removed automatic tab switch since tabs are merged

  const updateStatus = async (id, newStatus) => {
    try {
      await fetch('/api/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      fetchData(); 
    } catch (e) {
      console.error(e);
    }
  };

  const deleteVehicle = async (id) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await fetch('/api/vehicles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const trackVehicle = (vehicle) => {
    setTrackingVehicle(vehicle);
    
    const locations = [
      "Toll Plaza North",
      "MG Road Intersection",
      "Airport Road Signal",
      "Tech Park South Gate",
      "Central Market Camera",
      "Highway Exit 4",
      "City Border Checkpoint"
    ];
    
    const numPastLocations = Math.floor(Math.random() * 3) + 2;
    const shuffled = [...locations].sort(() => 0.5 - Math.random());
    const route = [];
    
    let currentTime = new Date(vehicle.timestamp).getTime();
    
    for (let i = 0; i < numPastLocations; i++) {
      currentTime -= Math.floor(Math.random() * 15 * 60000) + (5 * 60000); // 5-20 mins before
      route.push({
        location: shuffled[i],
        timestamp: new Date(currentTime),
        camera: `CAM-${Math.floor(Math.random() * 100) + 10}`
      });
    }
    
    route.sort((a, b) => a.timestamp - b.timestamp);
    
    route.push({
      location: vehicle.location || "Current Detection",
      timestamp: new Date(vehicle.timestamp),
      camera: "CAM-01 (Current)"
    });
    
    setSimulationData(route);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0 25px 0', borderBottom: '1px solid rgba(0, 255, 128, 0.2)', marginBottom: '30px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <motion.h1 
            className="neon-text"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, type: "spring", stiffness: 120 }}
            style={{ margin: 0, fontSize: '2.5rem', letterSpacing: '2px', textTransform: 'uppercase' }}
          >
            Stolen Vehicle Recovery
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            style={{ color: '#00ff80', letterSpacing: '5px', textTransform: 'uppercase', fontSize: '0.9rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <motion.span 
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#00ff80', boxShadow: '0 0 15px #00ff80' }}
            ></motion.span>
            Central Admin Portal
          </motion.div>
        </div>
        <motion.button 
          className="btn-primary" 
          onClick={fetchData}
          whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(0, 255, 128, 0.4)' }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ padding: '12px 24px', fontSize: '1rem', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <motion.span
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            ↻
          </motion.span> 
          Refresh Data
        </motion.button>
      </header>

      <motion.div 
        className={styles.tabs}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <button 
          className={`${styles.tab} ${activeTab === 'livefeed' ? styles.active : ''}`}
          onClick={() => setActiveTab('livefeed')}
        >
          Camera Feed
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'detected' ? styles.active : ''}`}
          onClick={() => setActiveTab('detected')}
        >
          Detected Vehicles
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'reported' ? styles.active : ''}`}
          onClick={() => setActiveTab('reported')}
        >
          Reported Vehicles
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'status' ? styles.active : ''}`}
          onClick={() => setActiveTab('status')}
        >
          Current Status
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'rtodb' ? styles.active : ''}`}
          onClick={() => setActiveTab('rtodb')}
        >
          RTO Database
        </button>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={activeTab}
          className={`glass-panel ${styles.tableContainer}`} 
          style={{padding: '20px'}}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {loading && <p>Loading data...</p>}
          
          {!loading && activeTab !== 'livefeed' && (
            <div style={{ marginBottom: '20px', display: 'flex' }}>
              {activeTab !== 'rtodb' ? (
                <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                  <input 
                    type="text" 
                    placeholder="Search Plate Number..." 
                    value={globalSearch} 
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    style={{ padding: '10px 35px 10px 15px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: 'white', flex: 1, fontSize: '1rem', outline: 'none' }}
                  />
                  {globalSearch && (
                    <button 
                      onClick={() => setGlobalSearch('')}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.5rem', padding: '0', display: 'flex', alignItems: 'center' }}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                  <input 
                    type="text" 
                    placeholder="Search RTO Database by Plate Number..." 
                    value={rtoSearch} 
                    onChange={(e) => setRtoSearch(e.target.value)}
                    style={{ padding: '10px 35px 10px 15px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: 'white', flex: 1, fontSize: '1rem', outline: 'none' }}
                  />
                  {rtoSearch && (
                    <button 
                      onClick={() => setRtoSearch('')}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.5rem', padding: '0', display: 'flex', alignItems: 'center' }}
                    >
                      &times;
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === 'reported' && (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Plate Number</th>
                  <th>Company/Model</th>
                  <th>Color</th>
                  <th>Last Seen Location</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {filteredReported.map((v, i) => (
                  <motion.tr 
                    key={v.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <td>{i + 1}</td>
                    <td>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        {new Date(v.createdAt).toLocaleString()}
                        {i === 0 && (
                          <span style={{
                            background: 'rgba(217, 70, 239, 0.2)',
                            border: '1px solid #d946ef',
                            color: '#d946ef',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            letterSpacing: '0.5px'
                          }}>
                            NEW
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{fontWeight: 'bold', color: 'var(--primary-glow)', display: 'flex', alignItems: 'center', gap: '10px'}}>
                      {v.plateNumber}
                      {detectedVehicles.some(d => d.plateNumber === v.plateNumber) && (
                        <span style={{
                          background: 'rgba(0, 255, 128, 0.2)', 
                          color: '#00ff80',
                          border: '1px solid #00ff80',
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          letterSpacing: '0.5px'
                        }}>
                          SPOTTED IN LIVE CAM!
                        </span>
                      )}
                    </td>
                    <td>{v.make} {v.model} {v.variant}</td>
                    <td>{v.color}</td>
                    <td>{v.location}</td>
                    <td 
                      onClick={() => togglePhone(v.id)} 
                      style={{cursor: 'pointer'}}
                      title="Click to reveal"
                    >
                      {revealedPhones.has(v.id) ? v.phone : 'XXXXXXXXXX'}
                    </td>
                  </motion.tr>
                ))}
                {filteredReported.length === 0 && (
                  <tr><td colSpan="6" style={{textAlign:'center'}}>No reported vehicles found.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {!loading && activeTab === 'detected' && (
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Timestamp</th>
                  <th>Plate Number</th>
                  <th>Company/Model</th>
                  <th>Color</th>
                  <th>Camera Location</th>
                  <th>RTO Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetected.map((v, i) => (
                  <motion.tr 
                    key={v.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <td>
                      {v.imageUrl ? (
                        <img 
                          src={v.imageUrl} 
                          alt="Detected Vehicle" 
                          onClick={() => setSelectedImage(v.imageUrl)}
                          style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(0,255,128,0.3)', cursor: 'pointer' }} 
                        />
                      ) : (
                        <span style={{color: '#555', fontSize: '0.8rem'}}>No Image</span>
                      )}
                    </td>
                    <td>{new Date(v.timestamp).toLocaleString()}</td>
                    <td style={{fontWeight: 'bold', color: 'var(--primary-glow)'}}>{v.plateNumber}</td>
                    <td>{v.make || '-'} {v.model || '-'}</td>
                    <td>{v.color || '-'}</td>
                    <td>{v.location || 'Unknown'}</td>
                    <td>
                      {v.rtoStatus === 'UNREGISTERED' && (
                         <span style={{color: '#ff4d4d', fontWeight: 'bold'}}>UNREGISTERED</span>
                      )}
                      {v.rtoStatus === 'MISMATCH' && (
                         <span style={{color: '#ffa500', fontWeight: 'bold'}} title={v.rtoDetails}>MISMATCH</span>
                      )}
                      {v.rtoStatus === 'VALID' && (
                         <span style={{color: '#00ff80', fontWeight: 'bold'}}>VALID</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className={styles.trackBtn} 
                        onClick={() => trackVehicle(v)}
                      >
                        Track
                      </button>
                    </td>
                  </motion.tr>
                ))}
                {filteredDetected.length === 0 && (
                  <tr><td colSpan="8" style={{textAlign:'center'}}>No vehicles detected yet. Run camera feed.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {!loading && activeTab === 'livefeed' && (
            <div ref={liveFeedRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minHeight: '600px' }}>
              <AnimatePresence mode="wait">
                {streamState === 'waiting' && (
                  <motion.div 
                    key="waiting"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20, position: 'absolute' }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{ padding: '60px 40px', textAlign: 'center', color: '#00ff80', border: '1px solid rgba(0, 255, 128, 0.2)', borderRadius: '24px', background: 'linear-gradient(145deg, rgba(0, 255, 128, 0.05) 0%, rgba(0,0,0,0.8) 100%)', backdropFilter: 'blur(16px)', width: '100%', maxWidth: '500px', margin: '60px auto', boxShadow: 'inset 0 0 30px rgba(0,255,128,0.05), 0 20px 40px rgba(0,0,0,0.5)' }}
                  >
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.1, 0.9], boxShadow: ['0 0 0px rgba(0,255,128,0)', '0 0 30px rgba(0,255,128,0.5)', '0 0 0px rgba(0,255,128,0)'] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0, 255, 128, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px auto', border: '2px solid rgba(0,255,128,0.4)' }}
                    >
                      <span style={{ fontSize: '2rem' }}>📡</span>
                    </motion.div>
                    
                    <h3 style={{ margin: 0, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 700, fontSize: '1.2rem', textShadow: '0 0 10px rgba(0,255,128,0.5)' }}>Awaiting Camera Feed</h3>
                    <p style={{ margin: '15px 0 0', color: '#888', fontSize: '0.95rem', lineHeight: '1.6' }}>The secure socket is open.<br/>Execute the AI pipeline script in your terminal to initiate the video stream.</p>
                  </motion.div>
                )}
                
                {streamState === 'finished' && (
                  <motion.div 
                    key="finished"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20, position: 'absolute' }}
                    transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                    whileHover={{ scale: 1.02, boxShadow: '0 25px 50px rgba(217, 70, 239, 0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab('detected')}
                    style={{ padding: '60px 40px', textAlign: 'center', color: '#d946ef', border: '1px solid rgba(217, 70, 239, 0.4)', borderRadius: '24px', background: 'linear-gradient(145deg, rgba(217, 70, 239, 0.1) 0%, rgba(0,0,0,0.8) 100%)', backdropFilter: 'blur(16px)', cursor: 'pointer', transition: 'box-shadow 0.3s ease', width: '100%', maxWidth: '500px', margin: '60px auto', boxShadow: '0 15px 30px rgba(0,0,0,0.5)' }}
                  >
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(217, 70, 239, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px auto', border: '2px solid rgba(217, 70, 239, 0.5)', boxShadow: '0 0 20px rgba(217, 70, 239, 0.3)' }}>
                      <span style={{ fontSize: '2rem' }}>✅</span>
                    </div>
                    <h3 style={{ margin: 0, letterSpacing: '2px', fontWeight: 700, fontSize: '1.3rem', textTransform: 'uppercase', textShadow: '0 0 10px rgba(217, 70, 239, 0.4)' }}>Stream Completed</h3>
                    
                    <motion.div 
                      whileHover={{ x: 5 }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', margin: '25px 0 0', padding: '12px 24px', background: 'rgba(217, 70, 239, 0.15)', borderRadius: '30px', color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}
                    >
                      View Results <span>➔</span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div 
                initial={false}
                animate={
                  streamState === 'running' 
                    ? { opacity: 1, scale: 1, display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }
                    : { opacity: 0, scale: 0.9, position: 'absolute', transitionEnd: { display: 'none' } }
                }
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{ width: '100%', border: '2px solid rgba(0,255,128,0.3)', boxShadow: '0 0 50px rgba(0,255,128,0.15)', background: 'rgba(0, 255, 128, 0.03)', padding: '20px', borderRadius: '16px' }}
              >
                {/* Top Section: Video & Stats */}
                <div style={{ display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap' }}>
                  
                  {/* Left: Video */}
                  <div style={{ flex: '2 1 500px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#000', minHeight: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                      src="http://127.0.0.1:5001/video_feed" 
                      alt="Live AI Camera Feed" 
                      onLoad={() => setStreamState('running')}
                      onError={(e) => {
                        if (streamState === 'running') {
                          setStreamState('finished');
                        }
                      }}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
                    />
                  </div>
                  
                  {/* Right: Stats Panel */}
                  <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '15px', background: 'rgba(0,0,0,0.4)', padding: '25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h2 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', letterSpacing: '2px', color: '#fff', borderBottom: '1px solid #333', paddingBottom: '15px' }}>ANPR LIVE DETECTIONS</h2>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                      <span style={{ color: '#888', fontSize: '0.8rem', letterSpacing: '1px' }}>CAMERA NODE ID</span>
                      <span style={{ color: '#ddd', fontSize: '0.8rem', fontFamily: 'monospace' }}>CAM_01 - MAIN ROAD</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                      <span style={{ color: '#888', fontSize: '0.8rem', letterSpacing: '1px' }}>FRAME RATE</span>
                      <span style={{ color: '#ddd', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        AI: {liveData?.ai_fps?.toFixed(1) || '0.0'} | GUI: {liveData?.gui_fps?.toFixed(1) || '0.0'} FPS
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                      <span style={{ color: '#888', fontSize: '0.8rem', letterSpacing: '1px' }}>OCR CONFIDENCE</span>
                      <span style={{ color: '#00ff80', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {liveData?.conf ? (liveData.conf * 100).toFixed(1) : '0.0'} %
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px', marginTop: '15px' }}>
                      <span style={{ color: '#888', fontSize: '0.8rem', letterSpacing: '1px' }}>NUMBER PLATE</span>
                      <span style={{ color: 'var(--primary-glow)', fontSize: '1.3rem', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '2px' }}>
                        {liveData?.plate || '-'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                      <span style={{ color: '#888', fontSize: '0.8rem', letterSpacing: '1px' }}>MAKE</span>
                      <span style={{ color: '#00ff80', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {liveData?.make?.toUpperCase() || '-'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                      <span style={{ color: '#888', fontSize: '0.8rem', letterSpacing: '1px' }}>COLOR</span>
                      <span style={{ color: '#00ff80', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {liveData?.color?.toUpperCase() || '-'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #333' }}>
                      <span style={{ color: '#888', fontSize: '0.8rem', letterSpacing: '1px' }}>SYSTEM STATUS</span>
                      <span style={{ color: liveData?.status === 'DETECTED' ? '#00ff80' : '#ffa500', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '1px' }}>
                        STATUS: {liveData?.status || 'IDLE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Crops */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginTop: '5px' }}>
                  {[
                    { label: 'DET. VEHICLE', src: liveData?.crop_vehicle },
                    { label: 'DET. PLATE', src: liveData?.crop_plate },
                    { label: 'GRAYSCALE CROP', src: liveData?.crop_gray },
                    { label: 'CLAHE ENHANCED', src: liveData?.crop_clahe }
                  ].map((crop, idx) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ color: '#00e5ff', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '15px', width: '100%', textAlign: 'left' }}>
                        {crop.label}
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px', width: '100%', background: '#111', borderRadius: '4px', overflow: 'hidden' }}>
                        {crop.src ? (
                          <img src={`data:image/jpeg;base64,${crop.src}`} alt={crop.label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ color: '#333', fontSize: '0.7rem', letterSpacing: '1px' }}>AWAITING...</span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Final OCR Elect Panel */}
                  <div style={{ background: 'rgba(0,255,128,0.05)', border: '1px solid rgba(0,255,128,0.2)', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ color: '#00e5ff', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '15px', width: '100%', textAlign: 'left' }}>
                      FINAL OCR ELECT
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px', width: '100%', background: '#fff', color: '#000', borderRadius: '4px', fontSize: '1.6rem', fontWeight: 'bold', letterSpacing: '2px', boxShadow: '0 0 20px rgba(255,255,255,0.2)' }}>
                      {liveData?.plate || '-'}
                    </div>
                  </div>
                </div>

              </motion.div>
            </div>
          )}

          {!loading && activeTab === 'status' && (
            <table>
              <thead>
                <tr>
                  <th>Plate Number</th>
                  <th>Company/Model</th>
                  <th>Reported Location</th>
                  <th>Current Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReported.map((v, i) => (
                  <motion.tr 
                    key={v.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <td style={{fontWeight: 'bold', color: 'var(--primary-glow)'}}>{v.plateNumber}</td>
                    <td>{v.make} {v.model}</td>
                    <td>{v.location}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles['status-' + v.status]}`}>
                        {v.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <select 
                          value={v.status} 
                          onChange={(e) => updateStatus(v.id, e.target.value)}
                        >
                          <option value="MISSING">Missing</option>
                          <option value="SPOTTED">Spotted</option>
                          <option value="RECOVERED">Recovered</option>
                        </select>
                        {v.status === 'RECOVERED' && (
                          <button 
                            onClick={() => deleteVehicle(v.id)} 
                            className={styles.deleteBtn}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && activeTab === 'rtodb' && (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Image</th>
                  <th>Date Registered</th>
                  <th>Plate Number</th>
                  <th>Owner Name</th>
                  <th>Make/Model</th>
                  <th>Color</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {filteredRto.map((v, i) => {
                  const spottedMatch = detectedVehicles.find(d => d.plateNumber === v.plateNumber && d.rtoStatus === 'VALID');
                  const displayImage = spottedMatch && spottedMatch.imageUrl ? spottedMatch.imageUrl : v.imageUrl;

                  return (
                  <motion.tr 
                    key={v.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <td>{i + 1}</td>
                    <td>
                      {displayImage ? (
                        <div 
                          onClick={() => setSelectedImage(displayImage)}
                          style={{width: '60px', height: '40px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0, 255, 128, 0.3)', cursor: 'pointer'}}
                          title="Click to view image"
                        >
                          <img src={displayImage} alt={`${v.make} ${v.model}`} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                        </div>
                      ) : (
                        <div style={{width: '60px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#888'}}>No Image</div>
                      )}
                    </td>
                    <td>{new Date(v.createdAt).toLocaleDateString()}</td>
                    <td style={{fontWeight: 'bold', color: 'var(--primary-glow)'}}>
                      {v.plateNumber}
                      {detectedVehicles.some(d => d.plateNumber === v.plateNumber && d.rtoStatus === 'VALID') && (
                         <span style={{marginLeft: '10px', backgroundColor: 'var(--primary-glow)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '12px'}}>
                           SPOTTED IN LIVE FEED
                         </span>
                      )}
                    </td>
                    <td>{v.ownerName}</td>
                    <td>{v.make} {v.model}</td>
                    <td>{v.color}</td>
                    <td 
                      onClick={() => togglePhone(v.id)} 
                      style={{cursor: 'pointer'}}
                      title="Click to reveal"
                    >
                      {revealedPhones.has(v.id) ? v.phone : 'XXXXXXXXXX'}
                    </td>
                  </motion.tr>
                );
                })}
                {filteredRto.length === 0 && (
                  <tr><td colSpan="8" style={{textAlign:'center'}}>No RTO records found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              className={styles.modalContent}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className={styles.closeBtn} onClick={() => setSelectedImage(null)}>&times;</button>
              <img src={selectedImage} alt="Enlarged Vehicle" className={styles.modalImage} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tracking Modal */}
      <AnimatePresence>
        {trackingVehicle && (
          <motion.div 
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTrackingVehicle(null)}
          >
            <motion.div 
              className={styles.trackingModalContent}
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className={styles.closeBtn} onClick={() => setTrackingVehicle(null)}>&times;</button>
              <h2 className="neon-text" style={{ marginBottom: '20px', fontSize: '1.5rem' }}>Tracking Simulation</h2>
              <div style={{ marginBottom: '20px' }}>
                <span style={{ color: '#aaa' }}>Target Plate: </span>
                <span style={{ fontWeight: 'bold', color: '#00ff80', fontSize: '1.2rem' }}>{trackingVehicle.plateNumber}</span>
              </div>
              
              <div className={styles.timeline}>
                {simulationData.map((point, index) => (
                  <motion.div 
                    key={index} 
                    className={styles.timelineItem}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.8 }}
                  >
                    <div className={styles.timelineDot}></div>
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineTime}>{point.timestamp.toLocaleTimeString()}</div>
                      <div className={styles.timelineLocation}>{point.location}</div>
                      <div className={styles.timelineCamera}>{point.camera}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
