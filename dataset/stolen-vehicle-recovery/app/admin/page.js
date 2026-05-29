"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState('reported');
  const [reportedVehicles, setReportedVehicles] = useState([]);
  const [detectedVehicles, setDetectedVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/vehicles');
      const data = await res.json();
      if (data.success) {
        setReportedVehicles(data.reported);
        setDetectedVehicles(data.detected);
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
          className={`${styles.tab} ${activeTab === 'detected' ? styles.active : ''}`}
          onClick={() => setActiveTab('detected')}
        >
          Detected Vehicles (Live)
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'status' ? styles.active : ''}`}
          onClick={() => setActiveTab('status')}
        >
          Current Status
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
          {!loading && activeTab === 'reported' && (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plate Number</th>
                  <th>Company/Model</th>
                  <th>Color</th>
                  <th>Last Seen Location</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {reportedVehicles.map((v, i) => (
                  <motion.tr 
                    key={v.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <td>{new Date(v.createdAt).toLocaleString()}</td>
                    <td style={{fontWeight: 'bold', color: 'var(--primary-glow)'}}>{v.plateNumber}</td>
                    <td>{v.make} {v.model} {v.variant}</td>
                    <td>{v.color}</td>
                    <td>{v.location}</td>
                    <td>{v.phone}</td>
                  </motion.tr>
                ))}
                {reportedVehicles.length === 0 && (
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
                </tr>
              </thead>
              <tbody>
                {detectedVehicles.map((v, i) => (
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
                  </motion.tr>
                ))}
                {detectedVehicles.length === 0 && (
                  <tr><td colSpan="6" style={{textAlign:'center'}}>No vehicles detected yet. Run YOLO script.</td></tr>
                )}
              </tbody>
            </table>
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
                {reportedVehicles.map((v, i) => (
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
    </div>
  );
}
