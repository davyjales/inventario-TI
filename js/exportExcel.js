// exportExcel.js

function exportTableToExcel(tableSelector, filename = 'relatorio.xlsx', sheetName = 'Dados') {
  const table = document.querySelector(tableSelector);
  if (!table) {
    console.warn('Tabela não encontrada:', tableSelector);
    return;
  }

  const workbook = XLSX.utils.table_to_book(table, { sheet: sheetName });
  XLSX.writeFile(workbook, filename);
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
