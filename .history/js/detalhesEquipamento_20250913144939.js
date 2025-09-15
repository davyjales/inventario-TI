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
});
