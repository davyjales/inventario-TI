document.addEventListener('DOMContentLoaded', () => {
  const reader = document.getElementById('reader');
  const resultDiv = document.getElementById('result');
  const manualInput = document.getElementById('manual-code-input');
  const manualSubmit = document.getElementById('manual-submit');

  let html5QrcodeScanner;

  function onScanSuccess(decodedText, decodedResult) {
    console.log(`Code matched = ${decodedText}`, decodedResult);
    resultDiv.innerHTML = `<p>Código detectado: ${decodedText}</p>`;

    // Stop scanning
    html5QrcodeScanner.clear();

    // Process the scanned code
    processScannedCode(decodedText);
  }

  function onScanFailure(error) {
    // console.warn(`Code scan error = ${error}`);
  }

  // Initialize scanner
  html5QrcodeScanner = new Html5QrcodeScanner(
    "reader",
    { fps: 10, qrbox: { width: 250, height: 250 } },
    /* verbose= */ false
  );

  html5QrcodeScanner.render(onScanSuccess, onScanFailure);

  async function processScannedCode(code) {
    try {
      // Assume the code is the equipment ID
      const equipmentId = parseInt(code);
      if (isNaN(equipmentId)) {
        resultDiv.innerHTML = '<p>Erro: Código QR inválido.</p>';
        return;
      }

      // Fetch equipment details
      const response = await fetch(`/api/equipamentos/${equipmentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          resultDiv.innerHTML = '<p>Equipamento não encontrado.</p>';
        } else {
          resultDiv.innerHTML = '<p>Erro ao consultar equipamento.</p>';
        }
        return;
      }

      const equipment = await response.json();

      // Log consultation
      await logConsultation(equipmentId);

      // Redirect to equipment details
      window.location.href = `detalhesEquipamento.html?id=${equipmentId}`;

    } catch (error) {
      console.error('Erro ao processar código:', error);
      resultDiv.innerHTML = '<p>Erro ao processar código escaneado.</p>';
    }
  }

  async function logConsultation(equipmentId) {
    try {
      const response = await fetch('/api/log-consulta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ equipmentId })
      });

      if (!response.ok) {
        console.error('Erro ao registrar consulta');
      }
    } catch (error) {
      console.error('Erro ao registrar consulta:', error);
    }
  }

  manualSubmit.addEventListener('click', () => {
    const code = manualInput.value.trim();
    if (code) {
      resultDiv.innerHTML = '';
      processScannedCode(code);
    }
  });

  manualInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      manualSubmit.click();
    }
  });
});
