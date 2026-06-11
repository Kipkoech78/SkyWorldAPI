const { create } = require('xmlbuilder2');

function sendXml(res, statusCode, rootName, data) {

    const root = create({ version: '1.0' }).ele(rootName);

    // if data is array -> repeat nodes
    if (Array.isArray(data)) {
        data.forEach(item => {
            const node = root.ele('item');

            Object.entries(item).forEach(([key, value]) => {
                node.ele(key).txt(value ?? '').up();
            });

            node.up();
        });
    } 
    // if object
    else if (typeof data === 'object') {
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
                const child = root.ele(key);

                Object.entries(value).forEach(([k, v]) => {
                    child.ele(k).txt(v ?? '').up();
                });

                child.up();
            } else {
                root.ele(key).txt(value ?? '').up();
            }
        });
    }

    const xml = root.end({ prettyPrint: true });

    res
        .status(statusCode)
        .type('application/xml')
        .send(xml);
}
function sendError(res, statusCode, message) {
    const xml = create({ version: '1.0' })
        .ele('error')
        .ele('message')
        .txt(message)
        .up()
        .end({ prettyPrint: true });

    res
        .status(statusCode)
        .type('application/xml')
        .send(xml);
}

module.exports = {
    sendXml,
    sendError
};

