# AgriTrack Setup Guide

## Environment Variables

Create a `.env` file in the `backend/` directory with the following configuration:

| Variable | Description | Example |
|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | Secret key for Django (change for production) | `your-secure-random-string` |
| `DEBUG` | Enable debug mode | `True` or `False` |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts | `localhost,127.0.0.1` |
| `MOCK_MODE` | Use demo data without API key | `True` or `False` |
| `AGROMONITORING_API_KEY` | AgroMonitoring API key (required if MOCK_MODE=False) | Get from https://home.agromonitoring.com/api_keys |

## Installation & Startup

### Backend (Django)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# On Linux/macOS
source venv/bin/activate

# On Windows
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# (Optional) Create admin superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000`.

### Frontend (React/Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

### Production Build

```bash
cd frontend
npm run build
```

Output will be in `frontend/dist/`. Deploy this folder to your web server.

---

## Quick Demo

To test with sample data (no API key required):

1. Set `MOCK_MODE=True` in `backend/.env`
2. Start the backend and frontend as described above
3. Open http://localhost:5173 and click the map near Berrechid, Morocco (33.26°N, -7.58°W)

---

## API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audit/` | Run satellite audit (body: `latitude`, `longitude`, optional `polygon_coords`) |
| GET | `/api/audits/` | List recent audits |
| GET | `/api/audits/{id}/` | Retrieve specific audit details |

### Request Example

```bash
curl -X POST http://localhost:8000/api/audit/ \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 33.26,
    "longitude": -7.58
  }'
```

---

## Troubleshooting

- **Module not found errors**: Ensure you've activated the virtual environment and run `pip install -r requirements.txt`
- **Database errors**: Run `python manage.py migrate` to initialize the database
- **Port conflicts**: Change port with `python manage.py runserver 8001` or `npm run dev -- --port 5174`
- **CORS errors**: Verify `ALLOWED_HOSTS` includes your frontend domain

For more information, see `README.md`.
