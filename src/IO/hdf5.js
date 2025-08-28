import * as jsfive from "jsfive";

export async function readH5File(file) {
  const response = await fetch(`${file}?t=${Date.now()}`);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);

  const buffer = await response.arrayBuffer();

  const h5File = new jsfive.File(buffer);
  const keys = h5File.keys;

  return Object.fromEntries(keys.map((key) => [key, h5File.get(key).value]));
}
