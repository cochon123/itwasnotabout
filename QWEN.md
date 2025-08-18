# Project Context for Qwen Code

## Project Overview

This project, "It Was Not About" (IWNA), is an AI-powered YouTube Shorts generator. It takes written stories as input and produces short video content, complete with AI-generated voiceovers, video montages, and dynamic subtitles.

The project is structured as a full-stack application:

- **Backend (Python):** Handles the core content generation pipeline, including story generation via AI (Google Gemini), Text-to-Speech (Higgs Audio v2), video editing (MoviePy), and subtitle generation (Whisper Timestamped).
- **Frontend (Web - React/Vite):** Provides a real-time, interactive web interface to monitor the generation process, view media outputs, and manage API keys.

## Key Technologies

- **Backend:** Python 3.10+, MoviePy, Whisper Timestamped, Google Generative AI (`gemini-2.5-flash`), Higgs Audio v2, `python-dotenv`.
- **Frontend:** React, Vite, Tailwind CSS, Three.js (for 3D elements).
- **Assets:** Requires video clips in `assets/video` and a font file (`assets/fonts/impact.ttf`) for subtitles.

## Building and Running

### Prerequisites

1.  Python 3.10+ installed.
2.  Node.js and npm installed for the frontend.
3.  API keys for Google (Gemini) and OpenAI. Copy `.env.example` to `.env` and fill in the keys.

### Backend Setup and Execution

1.  **Install Python Dependencies:**
    ```bash
    pip install -r backend/requirements.txt
    ```
2.  **Run the Generation Pipeline:**
    The main script appears to be `backend/scripts/run_pipeline.py` (based on the README example). Execute it to start the video generation process using stories from `backend/data/sample.md`.
    ```bash
    python backend/scripts/run_pipeline.py
    ```

### Frontend Setup and Execution

1.  **Navigate to Frontend Directory:**
    ```bash
    cd frontend
    ```
2.  **Install Node Dependencies:**
    ```bash
    npm install
    ```
3.  **Run Development Server:**
    This command starts both the Vite development server for the React app and a local Node.js server for backend communication (as per `package.json` scripts).
    ```bash
    npm run dev
    ```

## Development Conventions

### Backend

-   Python is used for the core logic.
-   Dependencies are managed via `backend/requirements.txt`.
-   Source scripts for generation are located in `backend/scripts/`.
-   Libraries or local modules can be placed in `backend/libs/`.
-   Tests are expected to be in `backend/tests/`.

### Frontend

-   Built with React and Vite.
-   Uses Tailwind CSS for styling.
-   Dependencies and scripts are managed via `frontend/package.json`.
-   Source code is in `frontend/src/`.
-   A local Node.js server for the frontend app is located in `frontend/server/`.
-   The 3D orb component uses Three.js for rendering. To ensure click events work properly, event capturing is disabled on the Canvas component.

## Recent Fixes

### Frontend Orb Click Issue
-   **Problem**: The 3D orb component was not responding to click events.
-   **Cause**: The Three.js Canvas component was capturing click events and preventing them from reaching the parent div.
-   **Solution**: Disabled event capturing on the Canvas component by setting `events={{ enabled: false }}` in the Canvas properties.
-   The build output goes to `frontend/dist/`.

## Key Files and Directories

-   `readme.md`: Main project documentation detailing structure, backend processes, and frontend UI description.
-   `backend/data/sample.md`: Contains the input stories for video generation.
-   `backend/requirements.txt`: Lists all required Python packages.
-   `frontend/package.json`: Defines frontend dependencies and run scripts.
-   `assets/video/`: Directory for video clips used in the montage.
-   `assets/fonts/impact.ttf`: Required font for rendering subtitles.
-   `.env.example`: Template for API key configuration.

## how should qwen work.

-   do not run npm run dev, it is already running