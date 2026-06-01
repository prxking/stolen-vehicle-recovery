"use client";
import { useState, useEffect } from 'react';
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
  
  const [globalSearch, setGlobalSearch] = useState('');
  const [rtoSearch, setRtoSearch] = useState('');

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
    if (streamState === 'running') {
      pingInterval = setInterval(async () => {
        try {
          await fetch('http://127.0.0.1:5001/ping');
        } catch (err) {
          // Connection refused means server shut down
          setStreamState('finished');
        }
      }, 1000); // Check every second
    }
    return () => clearInterval(pingInterval);
  }, [streamState]);

  useEffect(() => {
    if (streamState === 'finished') {
      const timer = setTimeout(() => {
        setActiveTab('detected');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [streamState]);

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
      <header className={styles.header}>
        <motion.h1 
          className="neon-text"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          Admin Portal
        </motion.h1>
        <motion.button 
          className="btn-primary" 
          onClick={fetchData}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
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
          className={`${styles.tab} ${activeTab === 'reported' ? styles.active : ''}`}
          onClick={() => setActiveTab('reported')}
        >
          Reported Vehicles
        </button>
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
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', width: '100%' }}>
              <AnimatePresence mode="wait">
                {streamState === 'waiting' && (
                  <motion.div 
                    key="waiting"
                    initial={{ opacity: 0, scale: 0.9 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, position: 'absolute' }}
                    transition={{ duration: 0.4 }}
                    style={{ padding: '50px', textAlign: 'center', color: '#00ff80', border: '1px dashed rgba(0, 255, 128, 0.3)', borderRadius: '12px', background: 'rgba(0, 255, 128, 0.02)', backdropFilter: 'blur(10px)' }}
                  >
                    <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>📡</div>
                    <h3 style={{ margin: 0, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Waiting for camera feed...</h3>
                    <p style={{ margin: '10px 0 0', color: '#888', fontSize: '0.9rem' }}>Execute the AI pipeline script to initiate the secure stream.</p>
                  </motion.div>
                )}
                
                {streamState === 'finished' && (
                  <motion.div 
                    key="finished"
                    initial={{ opacity: 0, scale: 0.9 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, position: 'absolute' }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    onClick={() => setActiveTab('detected')}
                    style={{ padding: '50px', textAlign: 'center', color: '#d946ef', border: '1px solid rgba(217, 70, 239, 0.5)', borderRadius: '12px', background: 'rgba(217, 70, 239, 0.05)', cursor: 'pointer', boxShadow: '0 0 30px rgba(217, 70, 239, 0.1)', transition: 'all 0.3s ease' }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(217, 70, 239, 0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(217, 70, 239, 0.05)'}
                  >
                    <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>✅</div>
                    <h3 style={{ margin: 0, letterSpacing: '1px', fontWeight: 600 }}>DATA SENT TO DETECTED VEHICLES TAB</h3>
                    <p style={{ margin: '15px 0 0', color: '#aaa', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Click here to view results ➔</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div 
                initial={false}
                animate={
                  streamState === 'running' 
                    ? { opacity: 1, scale: 1, display: 'block', position: 'relative' }
                    : { opacity: 0, scale: 0.9, position: 'absolute', transitionEnd: { display: 'none' } }
                }
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{ width: '100%', maxWidth: '1000px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 0 40px rgba(0, 255, 128, 0.15)', border: '1px solid rgba(0, 255, 128, 0.3)' }}
              >
                <div style={{ background: '#0a0a0a', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,255,128,0.2)' }}>
                  <span style={{ color: '#00ff80', fontWeight: 'bold', fontSize: '0.75rem', letterSpacing: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', background: '#00ff80', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 10px #00ff80' }}></span>
                    LIVE FEED // SECURE
                  </span>
                  <span style={{ color: '#666', fontSize: '0.75rem', fontFamily: 'monospace', letterSpacing: '1px' }}>CAM_01 / MAIN_ROAD</span>
                </div>
                <img 
                  src="http://127.0.0.1:5001/video_feed" 
                  alt="Live AI Camera Feed" 
                  onLoad={() => setStreamState('running')}
                  onError={(e) => {
                    if (streamState === 'running') {
                      setStreamState('finished');
                    }
                  }}
                  style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
                />
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
                  <th>Date Registered</th>
                  <th>Plate Number</th>
                  <th>Owner Name</th>
                  <th>Make/Model</th>
                  <th>Color</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {filteredRto.map((v, i) => (
                  <motion.tr 
                    key={v.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <td>{i + 1}</td>
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
                ))}
                {filteredRto.length === 0 && (
                  <tr><td colSpan="7" style={{textAlign:'center'}}>No RTO records found.</td></tr>
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
