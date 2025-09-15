import { abrirModalEditarEquipamento } from './editEquipmentModal.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnEdit = document.getElementById('btn-edit');

  // Extract equipment ID from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const equipmentId = urlParams.get('id');

  if (btnEdit && equipmentId) {
    btnEdit.setAttribute('data-id', equipmentId);
    btnEdit.addEventListener('click', () => {
      abrirModalEditarEquipamento(equipmentId);
    });
  }

  if (equipmentId) {
    fetchEquipmentDetails(equipmentId);
  }
});

async function fetchEquipmentDetails(equipmentId) {
  try {
    const response = await fetch(`/equipamentos/${equipmentId}`);
    if (!response.ok) {
      throw new Error('Equipamento não encontrado');
    }
    const equipamento = await response.json();
    renderEquipmentDetails(equipamento);
  } catch (error) {
    console.error('Erro ao buscar detalhes do equipamento:', error);
    const container = document.getElementById('equipment-details-container');
    container.innerHTML = `<p>Erro ao carregar os detalhes do equipamento.</p>`;
  }
}

function renderEquipmentDetails(equipamento) {
  const container = document.getElementById('equipment-details-container');
  if (!container) return;

  // Clear previous content
  container.innerHTML = '';

  // Create HTML content for equipment details
  const html = `
    <div class="detail-section">
      <h3>Informações do Equipamento</h3>
      <div class="field-group">
        <div class="field-item">
          <div class="field-label">Nome:</div>
          <div class="field-value">${equipamento.nome || 'Não informado'}</div>
        </div>
        <div class="field-item">
          <div class="field-label">Categoria:</div>
          <div class="field-value">${equipamento.categoria || 'Não informado'}</div>
        </div>
        <div class="field-item">
          <div class="field-label">Usuário:</div>
          <div class="field-value">${equipamento.dono || 'Não informado'}</div>
        </div>
        <div class="field-item">
          <div class="field-label">Setor:</div>
          <div class="field-value">${equipamento.setor || 'Não informado'}</div>
        </div>
        <div class="field-item">
          <div class="field-label">Cargo:</div>
          <div class="field-value">${equipamento.cargo || 'Não informado'}</div>
        </div>
