"use client";

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import styles from './page.module.css';

export default function SuccessPage() {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <motion.div 
        className={`glass-panel ${styles.successCard}`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        >
          <CheckCircle size={80} color="#00ff80" className={styles.icon} />
        </motion.div>
        
        <motion.h1 
          className="neon-text"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Report Submitted Successfully
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={styles.message}
        >
          Your report has been submitted. We will contact you if there is a match or if your vehicle is notified.
        </motion.p>
        
        <motion.button 
          className="btn-primary" 
          onClick={() => router.push('/')}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{ marginTop: '30px' }}
        >
          Return to Home Page
        </motion.button>
      </motion.div>
    </div>
  );
}
