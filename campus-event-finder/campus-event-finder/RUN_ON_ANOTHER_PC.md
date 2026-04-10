# Run On Another PC (Step-by-Step)

## 1) Install Requirements
- Install **Node.js (LTS)**
- Install **MySQL/MariaDB**
  - Make sure the database server is running

## 2) Put the Folders Side-by-Side
```
campus-event-finder
campus-event-finder-backend
```

## 3) Open the Frontend Folder
Open a terminal in:
```
campus-event-finder
```

## 4) Install Dependencies (One Time)
```
install-all.bat
```

## 5) Start Both Servers
```
start-all.bat
```

## 6) Open in Browser
- Frontend: http://localhost:4200
- Backend: http://localhost:5000

## If MySQL Has a Password
Edit:
```
campus-event-finder-backend\.env
```
Then set:
```
DB_PASSWORD=yourpassword
```
