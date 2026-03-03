# Supermarket POS Web App

A button-first Point-of-Sale app tailored for supermarkets.

## Features
- Easy POS billing UI with click-to-add item cards and quantity controls.
- Inventory management via:
  - Manual item entry
  - CSV file upload
  - Google Sheets CSV URL sync
- Lightweight backend with JSON persistence.

## Run locally
```bash
npm install
npm start
```

Open `http://localhost:3000`.

## CSV format
The parser expects headers including `name` and `price`.
Optional headers: `category`, `barcode`.
