import fetch from 'node-fetch';

export async function handler(event, context) {
  // مسیر درخواست شده پس از دامنه
  let path = event.rawUrl.replace(/^https?:\/\/[^\/]+/, '');
  if (!path.startsWith('/')) path = '/' + path;

  // URL مقصد (مثلاً https://moz.com + مسیر)
  const targetUrl = 'https://' + path.replace(/^\/+/, '');

  try {
    const upstream = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: event.headers,
      body: event.body && event.body.length ? event.body : null,
      redirect: 'manual'
    });

    const body = await upstream.arrayBuffer();
    const headers = {};
    upstream.headers.forEach((v, k) => { headers[k] = v });

    return {
      statusCode: upstream.status,
      headers,
      body: Buffer.from(body).toString('base64'),
      isBase64Encoded: true
    };

  } catch (err) {
    return {
      statusCode: 502,
      body: `Proxy Error: ${err.message}`
    };
  }
}
