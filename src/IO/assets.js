export async function fetchShader(file) {
  const response = await fetch(`${file}?t=${Date.now()}`);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);

  const body = await response.text();

  return body;
}
