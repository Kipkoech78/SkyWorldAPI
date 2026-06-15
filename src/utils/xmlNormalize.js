function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

function normalizeQuestion(body = {}) {
  const attrs = body.$ || {};



  return {
    name: first(attrs.name),
    type,
    required: attrs.required === 'yes' || attrs.required === '1',

    text: first(body.text),
    description: first(body.description),

    options: body.options?.option || [],
    optionsMeta: body.options?.$ || {},

    file: body.file_properties?.$ || null
  };
}
module.exports = { first, normalizeQuestion };