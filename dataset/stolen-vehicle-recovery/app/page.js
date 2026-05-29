"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';
import { vehicleData, colorsList } from '../data/vehicles';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    plateNumber: '',
    location: '',
    company: '',
    model: '',
    variant: '',
    color: '',
    aadharNumber: '',
    phone: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    let { name, value } = e.target;
    
    // Automatically uppercase the number plate
    if (name === 'plateNumber') {
      value = value.toUpperCase();
    }

    // Enforce digit constraints actively for aadhar and phone
    if (name === 'aadharNumber' && value && !/^\d*$/.test(value)) return;
    if (name === 'phone' && value && !/^\d*$/.test(value)) return;

    if (name === 'company') {
      setFormData({ ...formData, company: value, model: '', variant: '' });
    } else if (name === 'model') {
      setFormData({ ...formData, model: value, variant: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    if (formData.phone.length !== 10) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { ...formData, make: formData.company };
      
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setIsSubmitting(false);
        router.push('/success');
      } else {
        alert(data.error || "Failed to submit report. Please try again.");
        setIsSubmitting(false);
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while submitting the report.");
      setIsSubmitting(false);
    }
  };

  const availableModels = formData.company ? Object.keys(vehicleData[formData.company]) : [];
  const availableVariants = formData.model ? vehicleData[formData.company][formData.model] : [];

  return (
    <div className={styles.container}>
      <motion.header 
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="neon-text">Stolen Vehicle Portal</h1>
        <p>Report and track missing vehicles with AI surveillance integration.</p>
      </motion.header>

      <motion.div 
        className={`glass-panel ${styles.formWrapper}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2>Report a Missing Vehicle</h2>
        <motion.form 
          onSubmit={handleInitialSubmit} 
          className={styles.form}
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div className={styles.inputGroup} variants={itemVariants}>
            <label>Number Plate</label>
            <input name="plateNumber" placeholder="e.g. KL 01 AB 1234" value={formData.plateNumber} onChange={handleChange} required />
          </motion.div>
          <motion.div className={styles.inputGroup} variants={itemVariants}>
            <label>Last Seen Location</label>
            <input name="location" placeholder="e.g. MG Road, Kochi" value={formData.location} onChange={handleChange} required />
          </motion.div>
          
          <motion.div className={styles.row} variants={itemVariants}>
            <div className={styles.inputGroup}>
              <label>Company</label>
              <select name="company" value={formData.company} onChange={handleChange} required>
                <option value="">Select Company</option>
                {Object.keys(vehicleData).sort().map(company => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label>Model</label>
              <select name="model" value={formData.model} onChange={handleChange} required disabled={!formData.company}>
                <option value="">Select Model</option>
                {availableModels.sort().map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </motion.div>
          
          <motion.div className={styles.row} variants={itemVariants}>
            <div className={styles.inputGroup}>
              <label>Variant</label>
              <select name="variant" value={formData.variant} onChange={handleChange} required disabled={!formData.model}>
                <option value="">Select Variant</option>
                {availableVariants.map(variant => (
                  <option key={variant} value={variant}>{variant}</option>
                ))}
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label>Color</label>
              <select name="color" value={formData.color} onChange={handleChange} required>
                <option value="">Select Color</option>
                {colorsList.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
          </motion.div>

          <motion.div className={styles.inputGroup} variants={itemVariants}>
            <label>Aadhar Number</label>
            <input 
              name="aadharNumber" 
              placeholder="Exactly 12 digits" 
              value={formData.aadharNumber} 
              onChange={handleChange} 
              maxLength="12"
              minLength="12"
              pattern="\d{12}"
              title="Aadhar must be exactly 12 digits"
              required 
            />
          </motion.div>
          <motion.div className={styles.inputGroup} variants={itemVariants}>
            <label>Registered Phone Number</label>
            <input 
              name="phone" 
              placeholder="Exactly 10 digits" 
              value={formData.phone} 
              onChange={handleChange} 
              maxLength="10"
              minLength="10"
              pattern="\d{10}"
              title="Phone number must be exactly 10 digits"
              required 
            />
          </motion.div>
          <motion.div className={styles.inputGroup} variants={itemVariants}>
            <label>Vehicle Image (Optional)</label>
            <input type="file" accept="image/*" />
          </motion.div>
          
          <motion.button 
            type="submit" 
            className="btn-primary" 
            style={{marginTop: '20px', width: '100%'}}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </motion.button>
        </motion.form>
      </motion.div>
    </div>
  );
}
