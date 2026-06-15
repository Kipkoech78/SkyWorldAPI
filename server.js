const express = require('express');
const cors = require('cors');
const  { sendXml, sendError }  = require('./src/middleware/xmlResponse')
const app = express();
const xmlparser = require('express-xml-bodyparser');

app.use(cors());

app.use(express.urlencoded({ extended: true }));


app.use(xmlparser());


require('dotenv').config();


const PORT = process.env.PORT || 3000;
const dbPool = require('./src/config/db')
const surveyRoutes = require('./src/routes/surveyRoutes');

//TEST CONNECTION
app.get('/', (req, res) => {

    dbPool.getConnection((err, connection) => {

        if (err) {
            console.error(err);
            return sendError(res, 500, 'Database connection failed');
        }

        connection.query(
            'SELECT * FROM surveys',
            (err, rows) => {

                connection.release();

                if (err) {
                    console.error(err);
                    return sendError(res, 500, 'Query execution failed');
                }

                return sendXml(
                    res,
                    200,
                    'surveys',
                    {
                        survey: rows.map(row => ({
                            '@id': row.id,
                            name: row.name,
                            description: row.description || ''
                        }))
                    }
                );
            }
        );
    });
});
//  404 handler  
app.use('/api', surveyRoutes);
app.use((_req, res) => {
  res.status(404).set('Content-Type', 'application/xml')
    .send('<error>Route not found</error>');
});


// Global error handler                                               

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).set('Content-Type', 'application/xml')
    .send(`<error>${err.message || 'Internal server error'}</error>`);
});


app.listen(PORT, () => {
   console.log(`Sky Survey API running on http://localhost:${PORT}`);
});