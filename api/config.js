export default function handler(request, response) {
  const postUrl = process.env.POST_URL || '';

  if (!postUrl) {
    return response.status(500).json({ error: 'POST_URL não configurada.' });
  }

  return response.status(200).json({ postUrl });
}
