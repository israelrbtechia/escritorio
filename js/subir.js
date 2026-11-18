// Sobe um arquivo para o Blob da Vercel do jeito que o projeto estiver conectado:
// - com chave (BLOB_READ_WRITE_TOKEN): direto do navegador para o Blob (aceita vídeos grandes);
// - sem chave (BLOB_STORE_ID, o jeito novo da Vercel): pelo servidor do prédio, até 4 MB por arquivo.
const CLIENTE_BLOB = 'https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.2/client/+esm';

/** Como o Blob está conectado: { blob, modo: 'token' | 'oidc' | null, maximoPeloServidor }. */
export async function estadoDoBlob(token) {
  try {
    const r = await fetch('/api/upload', { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) return { blob: false, modo: null };
    return await r.json();
  } catch { return { blob: false, modo: null }; }
}

export async function subirArquivo(arquivo, nome, tipo, { token, estado, aoProgresso = () => {} } = {}) {
  const st = estado || await estadoDoBlob(token);
  if (!st.blob) throw new Error('o Blob ainda não está ligado na Vercel (Storage → Blob → conectar ao projeto e fazer Redeploy).');
  if (st.modo === 'oidc') {
    const maximo = st.maximoPeloServidor || 4.3 * 1024 * 1024;
    if (arquivo.size > maximo) throw new Error(`o arquivo tem ${(arquivo.size / 1048576).toFixed(1)} MB e, com o Blob conectado sem chave, o servidor só recebe até ${(maximo / 1048576).toFixed(1)} MB. Para arquivos maiores, crie a chave BLOB_READ_WRITE_TOKEN no Blob da Vercel.`);
    aoProgresso(0);
    const r = await fetch(`/api/upload?arquivo=1&nome=${encodeURIComponent(nome)}&tipo=${encodeURIComponent(tipo)}`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' }, body: arquivo,
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.url) throw new Error(d?.erro || `o servidor respondeu ${r.status} ao subir o arquivo`);
    aoProgresso(1);
    return d.url;
  }
  const { upload } = await import(CLIENTE_BLOB);
  const r = await upload(nome, arquivo, {
    access: 'public', handleUploadUrl: '/api/upload', headers: { authorization: `Bearer ${token}` }, contentType: tipo,
    multipart: arquivo.size > 20 * 1024 * 1024, onUploadProgress: p => aoProgresso(p.loaded / (p.total || arquivo.size)),
  });
  return r.url;
}
