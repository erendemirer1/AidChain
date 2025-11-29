import './style.css';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const client = new SuiClient({
  url: getFullnodeUrl('testnet'),
});

// Senin registry ID'in:
const DEFAULT_REGISTRY_ID =
  '0x444f935655cce0e750d990192a0a6385aaeb7ad9b4d53c0bcf20ee8aa3c37f84';

const registryInput = document.getElementById('registry-input') as HTMLInputElement | null;
const loadBtn = document.getElementById('load-packages') as HTMLButtonElement | null;
const statusDiv = document.getElementById('status') as HTMLDivElement | null;
const packagesDiv = document.getElementById('packages') as HTMLDivElement | null;

function status(msg: string) {
  if (statusDiv) statusDiv.textContent = msg;
}

if (registryInput && DEFAULT_REGISTRY_ID) {
  registryInput.value = DEFAULT_REGISTRY_ID;
}

function statusLabel(s: number): string {
  if (s === 0) return '📦 Oluşturuldu';
  if (s === 1) return '🚚 Yolda';
  if (s === 2) return '✅ Teslim Edildi';
  return '❓ Bilinmiyor';
}

async function loadRegistry(registryId: string) {
  status('Registry okunuyor...');

  const registryObj = await client.getObject({
    id: registryId,
    options: { showContent: true },
  });

  if (registryObj.error) {
    status(`Registry okunamadı: ${registryObj.error.code}`);
    return null;
  }

  const content = registryObj.data?.content;
  if (!content || content.dataType !== 'moveObject') {
    status('Registry formatı geçersiz');
    return null;
  }

  return (content as any).fields;
}

async function loadPackages(registryId: string) {
  const reg = await loadRegistry(registryId);
  if (!reg) return;

  const ids: string[] = reg.packages;

  if (!ids || ids.length === 0) {
    status('Henüz kayıtlı yardım paketi yok.');
    if (packagesDiv) packagesDiv.innerHTML = '';
    return;
  }

  status(`Toplam ${ids.length} paket bulundu. Yükleniyor...`);

  const objs = await client.multiGetObjects({
    ids,
    options: { showContent: true },
  });

  if (!packagesDiv) return;
  packagesDiv.innerHTML = '';

  objs.forEach((obj, i) => {
    if (obj.error) return;

    const content = obj.data?.content;
    if (!content || content.dataType !== 'moveObject') return;

    const f = (content as any).fields;

    const card = document.createElement('div');
    card.className = 'card';

    // recipient'ı hiç kasmadan stringe çeviriyoruz
    const recipientStr = String(f.recipient ?? '');

    // Walrus proof_url alanı
    const proof: string = f.proof_url ?? '';

    card.innerHTML = `
      <h3>Paket #${i + 1}</h3>
      <p><strong>Açıklama:</strong> ${f.description}</p>
      <p><strong>Lokasyon:</strong> ${f.location}</p>
      <p><strong>Durum:</strong> ${statusLabel(Number(f.status))}</p>
      <p><strong>Bağışçı:</strong> ${f.donor}</p>
      <p><strong>Koordinatör:</strong> ${f.coordinator}</p>
      <p><strong>Recipient:</strong> ${recipientStr}</p>
      <p><strong>Teslim Kanıtı (Walrus):</strong> ${
        proof && proof.length > 0
          ? `<a href="${proof}" target="_blank" rel="noreferrer">${proof}</a>`
          : 'Henüz eklenmedi'
      }</p>
      <small>created_epoch: ${f.created_at_epoch}, updated_epoch: ${f.updated_at_epoch}</small>
    `;

    packagesDiv.appendChild(card);
  });

  status('Paketler başarıyla yüklendi.');
}

if (loadBtn) {
  loadBtn.onclick = () => {
    const id = registryInput!.value.trim();
    if (!id) {
      status('Lütfen registry ID gir.');
      return;
    }
    loadPackages(id);
  };
}
