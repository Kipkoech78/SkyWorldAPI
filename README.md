# simple-survey-api

A REST API for the Sky World Survey Platform. It allows administrators to manage surveys and questions, and enables users to submit and retrieve survey responses. All API responses are in XML format.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher
- [MySQL](https://www.mysql.com/) 8.0 or higher running locally
- A MySQL client (e.g. [MySQL Workbench](https://www.mysql.com/products/workbench/) or the `mysql` CLI) to run the setup script

---

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Kipkoech78/simple-survey-api.git
   cd simple-survey-api
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create the database and run the SQL setup script:

   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS sky_survey_db;"
   mysql -u root -p sky_survey_db < database/schema.sql
   ```

4. Create a `.env` file in the project root:

   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=sky_survey_db

   PORT=3000
   UPLOAD_DIR=uploads
   MAX_FILE_SIZE_MB=5
   ```

---

## Running Locally

Start the development server with hot reload:

```bash
npm run dev
```

Or start without hot reload:

```bash
npm start
```

The API will be available at `http://localhost:3000/api`.

### Available Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/surveys` | List all surveys |
| `POST` | `/api/surveys` | Create a survey |
| `PUT` | `/api/surveys/:id` | Update a survey |
| `DELETE` | `/api/surveys/:id` | Delete a survey |
| `GET` | `/api/surveys/:id/questions` | List questions for a survey |
| `POST` | `/api/surveys/:id/questions` | Add a question |
| `PUT` | `/api/surveys/:id/questions/:qid` | Update a question |
| `DELETE` | `/api/surveys/:id/questions/:qid` | Delete a question |
| `POST` | `/api/surveys/:id/responses` | Submit a response (multipart/form-data) |
| `GET` | `/api/surveys/:id/responses` | Fetch paginated responses |
| `GET` | `/api/certificates/:id` | Download a certificate file |

A Postman collection with sample requests and saved responses is included in the `postman/` directory.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| [Node.js](https://nodejs.org/) | Runtime environment |
| [Express 5](https://expressjs.com/) | HTTP server and routing |
| [MySQL 8](https://www.mysql.com/) | Relational database |
| [mysql2](https://github.com/sidorares/node-mysql2) | MySQL driver with prepared statements |
| [multer](https://github.com/expressjs/multer) | Multipart form-data and file upload handling |
| [xmlbuilder2](https://oozcitak.github.io/xmlbuilder2/) | Building XML API responses |
| [express-xml-bodyparser](https://github.com/macedigital/express-xml-bodyparser) | Parsing incoming XML request bodies |
| [uuid](https://github.com/uuidjs/uuid) | Generating unique filenames for uploaded files |
| [dotenv](https://github.com/motdotla/dotenv) | Environment variable management |
| [nodemon](https://nodemon.io/) | Auto-restart during development |
| [cors](https://github.com/expressjs/cors) | Cross-origin request handling |

---

## Assumptions Made

- All API requests and responses use **XML** (`application/xml`) except for response submission which uses **multipart/form-data**.
- Question `name` attributes are used as XML element names in responses; names containing spaces or special characters are sanitized to valid XML tag names on the fly.
- Only **PDF files** are accepted for file upload questions, enforced via Multer's `fileFilter`.
- Uploaded files are stored on the **local filesystem** under the `uploads/` directory (configured via `UPLOAD_DIR` in `.env`). No cloud storage is used.
- The `certificates` table does not store a `question_id` — files are linked to a response and identified by their original filename.
- Response answers for `single_choice` and `multiple_choice` questions are stored as individual rows in `response_answers` (one row per selected value).
- The email filter on `GET /responses` matches against the answer stored for whichever question has `type = 'email'` in that survey.
- Pagination defaults to page 1 with a page size of 10 if not specified in the query string.
- The database user configured in `.env` must have full privileges on `sky_survey_db`.