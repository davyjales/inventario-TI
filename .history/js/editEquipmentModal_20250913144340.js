export async function abrirModalEditarEquipamento(id) {
  try {
    // Fetch equipment data by ID
    const res = await fetch(`/api/equipamentos/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const equipamento = await res.json();

    // Populate edit form fields
    const editId = document.getElementById('edit-equipment-id');
    const editCategoria = document.getElementById('edit-categoria');
    const editNome = document.getElementById('edit-nome');
    const editDono = document.getElementById('edit-dono');
    const editSetor = document.getElementById('edit-setor');
    const editCargo = document.getElementById('edit-cargo');
    const editDescricao = document.getElementById('edit-descricao');
    const editStatus = document.getElementById('edit-status');

    if (editId) editId.value = equipamento.id || '';
    if (editCategoria) editCategoria.value = equipamento.categoria_id || '';
    if (editNome) editNome.value = equipamento.nome || '';
    if (editDono) editDono.value = equipamento.dono || '';
    if (editSetor) editSetor.value = equipamento.setor || '';
    if (editCargo) editCargo.value = equipamento.cargo || '';
    if (editDescricao) editDescricao.value = equipamento.descricao || '';
    if (editStatus) editStatus.value = equipamento.status_id || '';

