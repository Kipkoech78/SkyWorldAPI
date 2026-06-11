/**
 * Middleware that parses an incoming application/xml (or text/xml) body
 * and attaches the parsed JS object to req.xmlBody.
 */
const { parseStringPromise } = require('xml2js');

async function xmlBodyParser(req, res, next) {
  const contentType = req.headers['content-type'] || '';

  // Only parse XML bodies; skip multipart (handled by multer)
  if (
    !contentType.includes('application/xml') &&
    !contentType.includes('text/xml')
  ) {
    return next();
  }

  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', async () => {
    try {
      req.xmlBody = await parseStringPromise(raw, {
        explicitArray: false,
        mergeAttrs:    false,
        trim:          true,
      });
      next();
    } catch (err) {
      res.status(400).set('Content-Type', 'application/xml')
        .send('<error>Invalid XML body</error>');
    }
  });
}

module.exports = xmlBodyParser;
