const { create } = require('xmlbuilder2');

function sendXml(res, xmlRoot, status = 200) {
  const xml = xmlRoot.end({ prettyPrint: true });

  res
    .status(status)
    .set('Content-Type', 'application/xml')
    .send(xml);
}

function sendError(res, message, status = 400) {
  const root = create({ version: '1.0' })
    .ele('error')
    .ele('message')
    .txt(message);

  sendXml(res, root, status);
}

function boolAttr(val) {
  return (val === 1 || val === true || val === 'yes') ? 'yes' : 'no';
}

module.exports = { sendXml, sendError, boolAttr };