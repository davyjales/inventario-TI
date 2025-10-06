// exportExcel.js

async function exportTableToExcel(tableSelector, filename = 'relatorio.xlsx', sheetName = 'Dados') {
  const table = document.querySelector(tableSelector);
  if (!table) {
    console.warn('Tabela não encontrada:', tableSelector);
    return;
  }

  // Se for tabela de equipamentos, exportar todos em uma única folha
  if (tableSelector === '.tabela-equipamentos') {
    await exportEquipmentTableToMultipleSheets(table, filename);
  } else {
    // Caso contrário, exportar tabela normal
    const workbook = XLSX.utils.table_to_book(table, { sheet: sheetName });
    XLSX.writeFile(workbook, filename);
  }
}

async function exportEquipmentTableToMultipleSheets(table, filename) {
  const workbook = XLSX.utils.book_new();

  try {
    // Buscar equipamentos
    const equipmentResponse = await fetch('/api/equipamentos');
    if (!equipmentResponse.ok) throw new Error('Erro ao buscar equipamentos');
    const allEquipments = await equipmentResponse.json();

    // Buscar campos adicionais de categorias
    const camposResponse = await fetch('/api/campos-adicionais');
    if (!camposResponse.ok) throw new Error('Erro ao buscar campos adicionais');
    const categoriasCampos = await camposResponse.json();

    // Coletar todos os campos adicionais únicos
    const allAdditionalFields = new Set();
    categoriasCampos.forEach(cat => {
      (cat.campos || []).forEach(field => {
        allAdditionalFields.add(field.nome_exibicao);
      });
    });
    const additionalFieldsArray = Array.from(allAdditionalFields);

    // Exportar todos os equipamentos do banco de dados
    const visibleEquipments = allEquipments;

    // Cabeçalhos padrão
    const headers = ['Nome', 'QRCode', 'Usuário', 'Setor', 'Cargo', 'Categoria', 'Status'];

    // Adicionar cabeçalhos dos campos adicionais
    headers.push(...additionalFieldsArray);

    // Criar linhas para todos os equipamentos
    const rows = visibleEquipments.map(eq => {
      const row = [
        eq.nome || '',
        eq.qrCode ? eq.qrCode.replace('.png', '') : '',
        eq.dono || '',
        eq.setor || '',
        eq.cargo || '',
        eq.categoria || '',
        eq.status_nome || ''
      ];

      // Mapear campos adicionais
      additionalFieldsArray.forEach(field => {
        let value = 'N/A';

        if (eq.additionalFields && typeof eq.additionalFields === 'object') {
          // Caso chave corresponda exatamente
          if (eq.additionalFields[field] !== undefined) {
            value = eq.additionalFields[field];
          } else {
            // Tentar fallback case-insensitive
            const foundKey = Object.keys(eq.additionalFields).find(
              k => k.toLowerCase() === field.toLowerCase()
            );
            if (foundKey) value = eq.additionalFields[foundKey];
          }
        }

        row.push(value);
      });

      return row;
    });

    // Criar planilha única
    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Equipamentos');

    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Erro ao exportar para Excel:', error);
    alert('Erro ao exportar relatório. Tente novamente.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const reportBtn = document.getElementById('export-report-excel');
  const historyBtn = document.getElementById('export-history-excel');

  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      exportTableToExcel('.tabela-equipamentos', 'relatorio_equipamentos.xlsx', 'Relatório');
    });
  }

  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      exportTableToExcel('.tabela-historico', 'historico_equipamentos.xlsx', 'Histórico');
    });
  }
});