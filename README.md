# Stolen Vehicle Recovery AI Portal

An end-to-end, AI-powered system designed to automatically detect and flag stolen vehicles using computer vision. This system integrates a deep learning pipeline (YOLOv8 + PaddleOCR) with a modern web portal (Next.js) for real-time monitoring and reporting by authorities.

## 🚀 Features

- **Real-Time Detection Pipeline:** Uses YOLOv8 for vehicle and license plate detection.
- **Automated License Plate Recognition (ALPR):** Uses PaddleOCR to extract text from detected plates.
- **Next.js Web Portal:** A modern, glassmorphism-styled dashboard for monitoring and submitting reports.
- **Headless Cloud Deployment:** Completely containerized backend capable of running invisibly on remote servers without graphical UI dependencies.
- **Fully Dockerized:** Effortless deployment using Docker and `docker-compose`.
- **Integrated Database:** SQLite backend managed by Prisma ORM for tracking detected and stolen vehicles.

## 🏗️ Architecture & Tech Stack

- **Frontend:** Next.js (App Router), React, Framer Motion, Vanilla CSS (Glassmorphism UI)
- **Backend/AI:** Python 3.10, PyTorch, Ultralytics (YOLOv8), PaddleOCR, OpenCV
- **Database:** SQLite with Prisma ORM
- **Authentication:** NextAuth.js (Google OAuth)
- **Containerization:** Docker & Docker Compose

## 📦 Deployment Instructions (Cloud/VPS)

This system is pre-configured to run out-of-the-box on a cloud server (like DigitalOcean, Hetzner, or AWS) using Docker. 

### 1. Clone the repository on your server
```bash
git clone https://github.com/prxking/stolen-vehicle-recovery.git
cd stolen-vehicle-recovery
```

### 2. Launch the Application
Start the entire stack (Next.js Web Portal + Python AI Backend) in detached mode:
```bash
docker-compose up -d --build
```

### 3. Access the Portal
Open your browser and navigate to:
```
http://<YOUR_SERVER_IP>:3000
```
*(The Python AI script will automatically start processing video feeds in the background and sending any stolen vehicle matches to the web portal).*

## 💻 Local Development

If you wish to run the components locally without Docker for testing:

**1. Start the Next.js Portal:**
```bash
cd dataset/stolen-vehicle-recovery
npm install
npm run dev
```

**2. Start the Python AI Pipeline:**
```bash
# In a new terminal at the root directory
pip install -r requirements.txt # (ensure torch, ultralytics, paddleocr, opencv-python are installed)
python pro.py
```

## 🔒 Security Note
- The `.gitignore` file is configured to exclude large video files (`.mp4`), AI model weights (`.pt`), and development databases to prevent bloat.
- When running in Docker, the AI pipeline automatically sets `HEADLESS=True` to prevent `cv2.imshow` UI crashes on headless Linux servers.

---
*Built for real-time vehicle monitoring and automated recovery.*
